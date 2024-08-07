use std::sync::MutexGuard;

use rocket::response::status::{BadRequest, NotFound};
use rocket::response::content;
use rocket::State;
use serde_json;
use rand::thread_rng;
use rand::seq::SliceRandom;

use chashmap::CHashMap;
use std::collections::HashMap;

use crate::GameState;
use crate::{constants::*, models::game::{Game, init_teams}};

#[get("/start_game/<game_id>")]
pub async fn start_game(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;
        let players = &game.players;

        if players.lock().unwrap().len() % 2 != 0 {
            return Err(BadRequest("Game cannot start with an odd number of players".to_owned()));
        }

        if game.words.lock().unwrap().len() <
                players.lock().unwrap().len() * game.words_per_player_limit {
            return Err(BadRequest("Players still need to add words".to_owned()));
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
        let event: String = "start_game".to_owned();
        let _res = game.game_events.send(event.to_string());

        Ok(content::RawJson(game_id.to_string()))
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// Used for the front end to check if game has started every X seconds, in case anyone misses the "game_start" event
// Returns plain text true or false, or error message
#[get("/has_game_started/<game_id>")]
pub async fn has_game_started(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let has_game_started = &game.game_state.lock().unwrap().has_game_started;

        Ok(content::RawJson(has_game_started.to_string()))
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// Returns the entire state of the game as json, or plain text error message
#[get("/fetch_game_state/<game_id>")]
pub async fn fetch_game_state(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        let game_state_json: String = serde_json::to_string(game_state).unwrap();

        Ok(content::RawJson(game_state_json))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}

// The turn player will use this to update the timer every X milliseconds
// then an event with the new timer value will be sent to other players
#[get("/update_timer_state/<game_id>/<millis>/<turn_active>/<round_active>/<round>")]
pub async fn update_timer_state(game_id: i32, millis: i32, turn_active: bool, round_active: bool, round: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &mut game.game_state.lock().unwrap();

        game_state.timer = millis;
        game_state.is_turn_active = turn_active;
        game_state.is_round_active = round_active;
        game_state.round = round;

        let mut event: String = TIMER_UPDATE_EVENT_PREFIX.to_owned();
        event.push_str(millis.to_string().as_str());
        let _res = game.game_events.send(event.to_string());

        Ok(content::RawJson(millis.to_string()))
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// The turn player will use this to get a new word to explain to his teammate
// Returns the word in plain text or an error message
#[get("/fetch_word/<game_id>/<name>")]
pub async fn fetch_word_to_guess(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        if !game_state.lock().unwrap().turn_player.eq(name) {
            return Err(BadRequest("You are not the turn player".to_owned()));
        }

        if game_state.lock().unwrap().words_in_play.len() >= MAX_WORDS_IN_PLAY {
            return Err(BadRequest("You already have enough words in play".to_owned()));
        }

        // Get the last word from the words to guess list and move it to the words in play
        let maybe_word = game_state.lock().unwrap().words_to_guess.pop();
        if maybe_word.is_some() {
            let word = maybe_word.unwrap();
            let word_copy = word.clone();

            game_state.lock().unwrap().words_in_play.push(word);
            return Ok(content::RawJson(word_copy));
        }

        Err(BadRequest("No words left".to_owned()))
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// When a word has been guessed, the turn player will use this to mark it as guessed
// Returns as plain text either the word which has been guessed or an error message
#[get("/guess_word/<game_id>/<name>/<word>")]
pub async fn guess_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state: &mut MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();

        if !game_state.turn_player.eq(name) {
            return Err(BadRequest("You are not the turn player".to_owned()));
        }

        if !game_state.words_in_play.contains(&word.to_string()) {
            return Err(BadRequest("This word is not in play".to_owned()));
        }

        // Remove the word from words in play
        let mut guessed_word: String = "".to_string();
        for i in 0..game_state.words_in_play.len() {
            if game_state.words_in_play.get(i).unwrap().eq(word) {
                guessed_word = game_state.words_in_play.remove(i);
                break;
            }
        }

        if guessed_word.eq(word) {
            // Update guessed words per round per team
            let round: i32 = game_state.round;
            let team_index: i32 = game_state.team_member_to_team_index.get(name).unwrap().to_owned();
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
            return Ok(content::RawJson(guessed_word))
        }

        Err(BadRequest("No words left".to_owned()))
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// The turn player will use this to pass turn when the current turn has ended
#[get("/undo_guess_word/<game_id>/<name>")]
pub async fn undo_last_guess(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {    
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found".to_owned())),
    };

    let mut game_state = game.game_state.lock().map_err(|_| BadRequest("Failed to lock game state".to_owned()))?;

    if !game_state.turn_player.eq(name) {
        return Err(BadRequest("You are not the turn player".to_owned()));
    }

    let round: i32 = game_state.round;
    let team_index: i32 = match game_state.team_member_to_team_index.get(name) {
        Some(index) => *index,
        None => return Err(BadRequest("Team index not found".to_owned())),
    };

    let words_per_team: &mut HashMap<i32, Vec<String>> = game_state.words_guessed_per_team_per_round.get_mut(&round).ok_or_else(|| BadRequest("Round not found".to_owned()))?;
    let guessed_words_by_player: &mut Vec<String> = words_per_team.get_mut(&team_index).ok_or_else(|| BadRequest("Team index not found in round".to_owned())).unwrap();

    if guessed_words_by_player.is_empty() {
        return Err(BadRequest("No words guessed this round".to_owned()));
    }

    let last_word: String = guessed_words_by_player.last().cloned().ok_or_else(|| BadRequest("Failed to get last guessed word".to_owned()))?;

    guessed_words_by_player.pop();
    game_state.words_guessed.pop();

    game_state.words_to_guess.push(last_word.clone());

    // Send event that a guess was undone
    let mut event: String = UNDO_GUESS_EVENT_PREFIX.to_owned();
    event.push_str(last_word.as_str());
    let _ = game.game_events.send(event.to_string());

    Ok(content::RawJson(last_word.to_string()))
}

#[get("/next_turn/<game_id>")]
pub async fn next_turn(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game: chashmap::ReadGuard<'_, i32, Game> = games.get(&game_id).unwrap();
        let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();
        
        // Figure out which the next turn player is
        rotate_to_next_turn_player(game_state);

        // Reset timer and words in play
        game_state.timer = TIMER_START_VALUE;
        let mut removed_words_in_play: Vec<String> = Vec::new();
        removed_words_in_play.append(&mut game_state.words_in_play);
        game_state.words_to_guess.append(&mut removed_words_in_play);
        game_state.words_to_guess.shuffle(&mut thread_rng());

        // Tell everyone that a new turn is starting
        let _ = game.game_events.send(NEXT_TURN_EVENT.to_owned());

        Ok(content::RawJson(game_id.to_string()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}

// The turn player switches to the next round
// It is still their turn, unless they have less than a second left
#[get("/next_round/<game_id>")]
pub async fn next_round(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();

        // Reset words
        let mut guessed_words: Vec<String> = Vec::new();
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
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
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
    game_state.turn_player = turn_player.to_string();
}