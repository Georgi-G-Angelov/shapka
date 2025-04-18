use crate::auth::utils::generate_token;
use crate::extentions::vec_utils::RemoveElem;
use crate::models::game::init_game;
use crate::models::game::Game;
use crate::constants::*;

use chashmap;
use chashmap::CHashMap;
use json::object;
use rand::Rng;

use rocket::response::status::BadRequest;
use rocket::State;
use rocket::response::content;

// Creates a game given a player name and a word limit (per player)
// Returns a json with the game id and the generated auth token for this player
#[get("/create_game/<player_name>/<word_limit>")]
pub fn create_game(player_name: &str, word_limit: usize, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>>{
    let mut rng = rand::thread_rng();

    if word_limit < MIN_WORDS_PER_PLAYER {
        return Err(BadRequest(format!("Word count per player is too low. Lower limit is {}", MIN_WORDS_PER_PLAYER)));
    } else if word_limit > MAX_WORDS_PER_PLAYER {
        return Err(BadRequest(format!("Word count per player is too high. Upper limit is {}", MAX_WORDS_PER_PLAYER)));
    }

    // Init id
    let mut id: i32 = rng.gen_range(0..MAX_GAME_ID);
    while games.contains_key(&id) {
        id = rng.gen_range(0..MAX_GAME_ID);
    }

    let game: Game = init_game(id, player_name, word_limit);
    let auth_secret: String = game.auth_secret.to_string();
    games.insert(id, game);

    let response = object! {
        name: player_name,
        gameId: id,
        authToken: generate_token(id, player_name.to_string(), auth_secret)
    };

    Ok(content::RawJson(response.to_string()))
}

// When a player wants to join the game, they must supply a valid game id and their name
// Returns a json with the game id and the generated auth token for this player
// or plain text error if game id is not found or player name in this game already exists
#[get("/join_game/<game_id>/<name>")]
pub async fn join_game<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };

    let mut players = game.players.lock().unwrap();

    if players.contains(&name.to_string()) {
        Err(BadRequest("Name already exists"))
    } else {
        players.push(name.to_string());

        // Tell all other people in the game that a new player has joined
        let mut event: String = NEW_PLAYER_EVENT_PREFIX.to_owned();
        event.push_str(name);
        let _res = game.game_events.send(event.to_string());

        let response = object! {
            name: name,
            gameId: game_id,
            authToken: generate_token(game_id, name.to_string(), game.auth_secret.to_string())
        };
        game.game_state.lock().unwrap().words_per_player.insert(name.to_string(), Vec::new());
    
        Ok(content::RawJson(response.to_string()))
    }
}

// A player who is not the host can leave the game
#[get("/leave_game/<game_id>/<name>")]
pub async fn leave_game<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };

    let mut players = game.players.lock().unwrap();

    if !players.contains(&name.to_string()) {
        Err(BadRequest("Player not in game"))
    } else {
        // Remove the player
        players.remove_element(name.to_string());

        // If player has added words, get rid of them
        let words_per_player = &mut game.game_state.lock().unwrap().words_per_player;
        match words_per_player.get(name) {
            Some(words) => {
                let mut game_words = game.words.lock().unwrap();
                for word in words {
                    game_words.remove_element(word.to_string());
                }
                words_per_player.remove(name);
            },
            None => ()
        };

        // Tell all other people in the game that a player has left
        let mut event: String = PLAYER_LEFT_EVENT_PREFIX.to_owned();
        event.push_str(name);

        let _res = game.game_events.send(event);
        Ok(content::RawJson(game_id.to_string()))
    }
}

// A player who is not the host can leave the game
#[get("/kick_player/<game_id>/<name>/<player_to_kick>")]
pub async fn kick_player<'a>(game_id: i32, name: &str, player_to_kick: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };

    let mut players = game.players.lock().unwrap();

    if game.host_name != name.to_string() {
        return Err(BadRequest("Only the host can kick people"))
    }

    if !players.contains(&player_to_kick.to_string()) {
        return Err(BadRequest("Player not in game"))
    } else {
        // Remove the player
        players.remove_element(player_to_kick.to_string());

        // If player has added words, get rid of them
        let words_per_player = &mut game.game_state.lock().unwrap().words_per_player;
        match words_per_player.get(player_to_kick) {
            Some(words) => {
                let mut game_words = game.words.lock().unwrap();
                for word in words {
                    game_words.remove_element(word.to_string());
                }
                words_per_player.remove(player_to_kick);
            },
            None => ()
        };

        // Tell all other people in the game that a player has left
        let mut event: String = PLAYER_KICKED_EVENT_PREFIX.to_owned();
        event.push_str(player_to_kick);

        let _res = game.game_events.send(event);
        Ok(content::RawJson(game_id.to_string()))
    }
}