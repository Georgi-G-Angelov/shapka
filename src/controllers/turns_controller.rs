use std::sync::{Arc, MutexGuard};

use rocket::response::status::{BadRequest, NotFound};
use rocket::response::content;
use rocket::State;
use serde_json;
use rand::thread_rng;
use rand::seq::SliceRandom;

use chashmap::CHashMap;
use std::collections::HashMap;

use crate::extentions::arc_string::ArcString;
use crate::GameState;
use crate::{constants::*, models::game::{Game, init_teams}};

#[get("/start_game/<game_id>")]
pub async fn start_game<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let game_state = &game.game_state;
    let players = &game.players;

    if players.lock().unwrap().len() % 2 != 0 {
        return Err(BadRequest("Game cannot start with an odd number of players"));
    }

    if game.words.lock().unwrap().len() <
            players.lock().unwrap().len() * game.words_per_player_limit {
        return Err(BadRequest("Players still need to add words"));
    }

    // Split people into teams
    init_teams(game_state, players);

    // Shuffle words
    game.words
        .lock()
        .unwrap()
        .shuffle(&mut thread_rng());

    // All words are to be guessed
    game_state.lock().unwrap().words_to_guess.append(&mut game.words.lock().unwrap());

    // Tell everyone the game has started
    let _res = game.game_events.send(START_GAME_EVENT.to_owned());

    Ok(content::RawJson(game_id.to_string()))
}

// Returns the entire state of the game as json, or plain text error message
#[get("/fetch_game_state/<game_id>")]
pub async fn fetch_game_state<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(NotFound("Game not found")),
    };

    let game_state_json: String = serde_json::to_string(&game.game_state).unwrap();
    Ok(content::RawJson(game_state_json))
}

// The turn player will use this to update the timer every X milliseconds
// then an event with the new timer value will be sent to other players
#[get("/update_timer_state/<game_id>/<millis>/<turn_active>/<round_active>/<round>")]
pub async fn update_timer_state<'a>(game_id: i32, millis: i32, turn_active: bool, round_active: bool, round: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };

    let game_state = &mut game.game_state.lock().unwrap();

    game_state.timer = millis;
    game_state.is_turn_active = turn_active;
    game_state.is_round_active = round_active;
    game_state.round = round;

    let mut event: String = TIMER_UPDATE_EVENT_PREFIX.to_owned();
    event.push_str(millis.to_string().as_str());
    _ = game.game_events.send(event);

    Ok(content::RawJson(millis.to_string()))
}

// The turn player will use this to get a new word to explain to his teammate
// Returns the word in plain text or an error message
#[get("/fetch_word/<game_id>/<name>")]
pub async fn fetch_word_to_guess<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let name_arc = ArcString(Arc::new(name.to_string()));

    let game_state = &mut game.game_state.lock().unwrap();

    if !game_state.turn_player.eq(&name_arc) {
        return Err(BadRequest("You are not the turn player"));
    }

    if game_state.words_in_play.len() >= MAX_WORDS_IN_PLAY {
        return Err(BadRequest("You already have enough words in play"));
    }

    // Get the last word from the words to guess list and move it to the words in play
    match game_state.words_to_guess.pop() {
        Some(word) => {
            game_state.words_in_play.push(word.clone());
            return Ok(content::RawJson(word.to_string()));
        },
        None => return Err(BadRequest("No words left")),
    };
}

// When a word has been guessed, the turn player will use this to mark it as guessed
// Returns as plain text either the word which has been guessed or an error message
#[get("/guess_word/<game_id>/<name>/<word>")]
pub async fn guess_word<'a>(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let name_arc = ArcString(Arc::new(name.to_string()));
    let word_arc = ArcString(Arc::new(word.to_string()));

    let game_state: &mut MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();

    if !game_state.turn_player.eq(&name_arc) {
        return Err(BadRequest("You are not the turn player"));
    }

    if !game_state.words_in_play.contains(&word_arc) {
        return Err(BadRequest("This word is not in play"));
    }

    // Remove the word from words in play
    let mut guessed_word: ArcString = ArcString(Arc::new("".to_string()));
    for i in 0..game_state.words_in_play.len() {
        if game_state.words_in_play.get(i).unwrap().eq(&word_arc) {
            guessed_word = game_state.words_in_play.remove(i);
            break;
        }
    }

    if guessed_word.eq(&word_arc) {
        // Update guessed words per round per team
        let round: i32 = game_state.round;
        let team_index: i32 = game_state.team_member_to_team_index.get(&name_arc).unwrap().to_owned();
        let words_per_team = game_state.words_guessed_per_team_per_round.get_mut(&round).unwrap();
        if !words_per_team.contains_key(&team_index) {
            words_per_team.insert(team_index, Vec::new());
        }
        words_per_team.get_mut(&team_index).unwrap().push(guessed_word.clone());

        // Update game state words guessed
        game_state.words_guessed.push(guessed_word.clone());

        // Send event that a word was guessed
        let mut event: String = WORD_GUESSED_EVENT_PREFIX.to_owned();
        event.push_str(word);
        let _ = game.game_events.send(event.to_string());

        // If there are no more words to guess, round is over
        if game_state.words_to_guess.len() == 0 && game_state.words_in_play.len() == 0 {
            if game_state.round == NUM_ROUNDS {
                game_state.is_game_finished = true;
            }

            let _ = game.game_events.send(OUT_OF_WORDS_EVENT.to_owned());
        }
        return Ok(content::RawJson(guessed_word.to_string()))
    }

    Err(BadRequest("No words left"))
}

// The turn player will use this to pass turn when the current turn has ended
#[get("/undo_guess_word/<game_id>/<name>")]
pub async fn undo_last_guess<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {    
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let name_arc = ArcString(Arc::new(name.to_string()));

    let mut game_state = game.game_state.lock().unwrap();

    if !game_state.turn_player.eq(&name_arc) {
        return Err(BadRequest("You are not the turn player"));
    }

    let round: i32 = game_state.round;
    let team_index: i32 = match game_state.team_member_to_team_index.get(&name_arc) {
        Some(index) => *index,
        None => return Err(BadRequest("Team index not found")),
    };

    let words_per_team: &mut HashMap<i32, Vec<ArcString>> = game_state.words_guessed_per_team_per_round.get_mut(&round).ok_or_else(|| BadRequest("Round not found"))?;
    let guessed_words_by_player: &mut Vec<ArcString> = words_per_team.get_mut(&team_index).ok_or_else(|| BadRequest("Team index not found in round"))?;

    if guessed_words_by_player.is_empty() {
        return Err(BadRequest("No words guessed this round"));
    }

    // If a guess is undone, we add the word back in play

    // Get the word - must be the same word from the guessed_words_by_player and the words_guessed
    let last_word = guessed_words_by_player.pop().ok_or_else(|| BadRequest("Failed to get last guessed word"))?;
    game_state.words_guessed.pop();

    // If we have too many words in play, get rid of the last one and put it back in words_to_guess
    if game_state.words_in_play.len() >= MAX_WORDS_IN_PLAY {
        let last_fetched_word = game_state.words_in_play.pop().unwrap();
        game_state.words_to_guess.push(last_fetched_word);
    }

    // Add the undone word into the words in play
    game_state.words_in_play.push(last_word.clone());

    // Send event that a guess was undone
    let mut event: String = UNDO_GUESS_EVENT_PREFIX.to_owned();
    event.push_str(last_word.to_string().as_str());
    _ = game.game_events.send(event);

    Ok(content::RawJson(last_word.to_string()))
}

#[get("/next_turn/<game_id>")]
pub async fn next_turn<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(NotFound("Game not found")),
    };

    let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();
    
    // Figure out which the next turn player is
    rotate_to_next_turn_player(game_state);

    // Reset timer and words in play
    game_state.timer = TIMER_START_VALUE;
    let mut removed_words_in_play: Vec<ArcString> = Vec::new();
    removed_words_in_play.append(&mut game_state.words_in_play);
    game_state.words_to_guess.append(&mut removed_words_in_play);
    game_state.words_to_guess.shuffle(&mut thread_rng());

    // Tell everyone that a new turn is starting
    let _ = game.game_events.send(NEXT_TURN_EVENT.to_owned());

    Ok(content::RawJson(game_id.to_string()))
}

// The turn player switches to the next round
// It is still their turn, unless they have less than a second left
#[get("/next_round/<game_id>")]
pub async fn next_round<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(NotFound("Game not found")),
    };

    let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();

    // Reset words
    let mut guessed_words: Vec<ArcString> = Vec::new();
    guessed_words.append(&mut game_state.words_guessed);
    game_state.words_to_guess.append(&mut guessed_words);
    game_state.words_to_guess.shuffle(&mut thread_rng());

    // Shift round
    game_state.round += 1;
    game_state.is_round_active = true;

    // If less than a second left in round, don't bother
    if game_state.timer < 1000 {
        game_state.timer = TIMER_START_VALUE;
        rotate_to_next_turn_player(game_state);
    }

    // tell everyone it is the next round
    let _ = game.game_events.send(NEXT_ROUND_EVENT.to_owned());

    Ok(content::RawJson(game_id.to_string()))
}

// Get the next turn player from the player rotation
fn rotate_to_next_turn_player(game_state: &mut std::sync::MutexGuard<'_, GameState>) {
    // Increment the index of the turn player
    let mut turn_player_index = game_state.turn_player_index;
    turn_player_index += 1;

    // If we have reached the end of the rotation, start over
    if turn_player_index == game_state.player_rotation.len() {
        turn_player_index = 0;
    }

    // Update the game state
    game_state.turn_player_index = turn_player_index;
    let turn_player = game_state.player_rotation.get(turn_player_index).unwrap();
    game_state.turn_player = turn_player.clone();
}