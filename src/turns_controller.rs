use rocket::response::content;
use rocket::State;
use serde_json;
use rand::thread_rng;
use rand::seq::SliceRandom;

use chashmap::CHashMap;

use crate::{constants::*, game::{Game, init_teams}};

#[get("/start_game/<game_id>")]
pub async fn start_game(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;
        let players = &game.players;

        init_teams(game_state, players);

        game.words
            .lock()
            .unwrap()
            .shuffle(&mut thread_rng());

        game_state.lock().unwrap().words_to_guess.append(&mut game.words.lock().unwrap());

        let event: String = "start_game".to_owned();
        let _res = game.game_events.send(event.to_string());

        content::RawJson(game_id.to_string())

    } else {
        content::RawJson("Game not found".to_string())
    }
}

#[get("/fetch_game_state/<game_id>")]
pub async fn fetch_game_state(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        let game_state_json: String = serde_json::to_string(game_state).unwrap();

        content::RawJson(game_state_json)

    } else {
        content::RawJson("Game not found".to_string())
    }
}

#[get("/update_timer_state/<game_id>/<millis>")]
pub async fn update_timer_state(game_id: i32, millis: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        game_state.lock().unwrap().timer = millis;

        let mut event: String = "timer_update:".to_owned();
        event.push_str(millis.to_string().as_str());
        let _res = game.game_events.send(event.to_string());

        content::RawJson(millis.to_string())
    } else {
        content::RawJson("Game not found".to_string())
    }
}

#[get("/fetch_word/<game_id>/<name>")]
pub async fn fetch_word_to_guess(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;

        if !game_state.lock().unwrap().turn_player.eq(name) {
            return content::RawJson("Error: you are not the turn player".to_string());
        }

        if game_state.lock().unwrap().words_in_play.len() >= MAX_WORDS_IN_PLAY {
            return content::RawJson("Error: you already have enough words in play".to_string());
        }

        let maybe_word = game_state.lock().unwrap().words_to_guess.pop();
        if maybe_word.is_some() {
            let word = maybe_word.unwrap();
            let word_copy = word.clone();

            game_state.lock().unwrap().words_in_play.push(word);
            return content::RawJson(word_copy);
        }

        content::RawJson("Error: no words left".to_string())
    } else {
        content::RawJson("Game not found".to_string())
    }
}

#[get("/guess_word/<game_id>/<name>/<word>")]
pub async fn guess_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &mut game.game_state.lock().unwrap();

        if !game_state.turn_player.eq(name) {
            return content::RawJson("Error: you are not the turn player".to_string());
        }

        if !game_state.words_in_play.contains(&word.to_string()) {
            return content::RawJson("Error: this word is not in play".to_string());
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
            return content::RawJson(guessed_word);
        }

        content::RawJson("Error: no words left".to_string())
    } else {
        content::RawJson("Game not found".to_string())
    }
}
