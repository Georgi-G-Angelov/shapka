use rocket::response::status::{BadRequest, NotFound};
use rocket::response::content;
use rocket::State;
use serde_json;
use rand::thread_rng;
use rand::seq::SliceRandom;

use chashmap::CHashMap;

use crate::GameState;
use crate::{constants::*, game::{Game, init_teams}};

#[get("/start_game/<game_id>")]
pub async fn start_game(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;
        let players = &game.players;

        if players.lock().unwrap().len() % 2 != 0 {
            return Err(BadRequest(Some("Game cannot start with an odd number of players".to_owned())));
        }

        if game.words.lock().unwrap().len() <
                players.lock().unwrap().len() * game.words_per_player_limit {
            return Err(BadRequest(Some("Players still need to add words".to_owned())));
        }

        init_teams(game_state, players);

        game.words
            .lock()
            .unwrap()
            .shuffle(&mut thread_rng());

        game_state.lock().unwrap().words_to_guess.append(&mut game.words.lock().unwrap());

        let event: String = "start_game".to_owned();
        let _res = game.game_events.send(event.to_string());

        Ok(content::RawJson(game_id.to_string()))
    } else {
        Err(BadRequest(Some("Game not found".to_owned())))
    }
}

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
        Err(BadRequest(Some("Game not found".to_owned())))
    }
}

#[get("/fetch_word/<game_id>/<name>")]
pub async fn fetch_word_to_guess(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        if !game_state.lock().unwrap().turn_player.eq(name) {
            return Err(BadRequest(Some("You are not the turn player".to_owned())));
        }

        if game_state.lock().unwrap().words_in_play.len() >= MAX_WORDS_IN_PLAY {
            return Err(BadRequest(Some("You already have enough words in play".to_owned())));
        }

        let maybe_word = game_state.lock().unwrap().words_to_guess.pop();
        if maybe_word.is_some() {
            let word = maybe_word.unwrap();
            let word_copy = word.clone();

            game_state.lock().unwrap().words_in_play.push(word);
            return Ok(content::RawJson(word_copy));
        }

        Err(BadRequest(Some("No words left".to_owned())))
    } else {
        Err(BadRequest(Some("Game not found".to_owned())))
    }
}

#[get("/guess_word/<game_id>/<name>/<word>")]
pub async fn guess_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &mut game.game_state.lock().unwrap();

        if !game_state.turn_player.eq(name) {
            return Err(BadRequest(Some("You are not the turn player".to_owned())));
        }

        if !game_state.words_in_play.contains(&word.to_string()) {
            return Err(BadRequest(Some("This word is not in play".to_owned())));
        }

        let mut guessed_word: String = "".to_string();
        for i in 0..game_state.words_in_play.len() {
            if game_state.words_in_play.get(i).unwrap().eq(word) {
                guessed_word = game_state.words_in_play.remove(i);
                break;
            }
        }
        if guessed_word.eq(word) {
            game_state.words_guessed.push(guessed_word.clone());

            if game_state.words_to_guess.len() == 0 {
                let _ = game.game_events.send(OUT_OF_WORDS_EVENT.to_owned());
            }
            return Ok(content::RawJson(guessed_word))
        }

        Err(BadRequest(Some("No words left".to_owned())))
    } else {
        Err(BadRequest(Some("Game not found".to_owned())))
    }
}

#[get("/next_turn/<game_id>")]
pub async fn next_turn(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game: chashmap::ReadGuard<'_, i32, Game> = games.get(&game_id).unwrap();
        let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();
        
        rotate_to_next_turn_player(game_state);

        game_state.timer = TIMER_START_VALUE;
        let mut removed_words_in_play: Vec<String> = Vec::new();
        removed_words_in_play.append(&mut game_state.words_in_play);
        game_state.words_to_guess.append(&mut removed_words_in_play);
        game_state.words_to_guess.shuffle(&mut thread_rng());


        let _ = game.game_events.send(NEXT_TURN_EVENT.to_owned());

        Ok(content::RawJson(game_id.to_string()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}

#[get("/next_round/<game_id>")]
pub async fn next_round(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state: &mut std::sync::MutexGuard<'_, GameState> = &mut game.game_state.lock().unwrap();

        let mut guessed_words: Vec<String> = Vec::new();
        guessed_words.append(&mut game_state.words_guessed);
        game_state.words_to_guess.append(&mut guessed_words);
        game_state.words_to_guess.shuffle(&mut thread_rng());

        game_state.round += 1;
        game_state.is_round_active = true;

        // If less than a second left in round, don't bother
        if game_state.timer < 1000 {
            game_state.timer = TIMER_START_VALUE;
            rotate_to_next_turn_player(game_state);
        }

        let _ = game.game_events.send(NEXT_ROUND_EVENT.to_owned());

        Ok(content::RawJson(game_id.to_string()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}

fn rotate_to_next_turn_player(game_state: &mut std::sync::MutexGuard<'_, GameState>) {
    let mut turn_player_index = game_state.turn_player_index;
    turn_player_index += 1;
    if turn_player_index == game_state.player_rotation.len() {
        turn_player_index = 0;
    }
    game_state.turn_player_index = turn_player_index;
    let turn_player = game_state.player_rotation.get(turn_player_index).unwrap();
    game_state.turn_player = turn_player.to_string();
}