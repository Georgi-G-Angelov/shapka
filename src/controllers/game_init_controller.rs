use crate::auth::utils::generate_token;
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
        return Err(BadRequest("Word limit per player is either too low.".to_owned()));
    } else if word_limit > MAX_WORDS_PER_PLAYER {
        return Err(BadRequest("Word limit per player is either too high.".to_owned()));
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
        gameId: id,
        authToken: generate_token(id, player_name.to_string(), auth_secret)
    };

    Ok(content::RawJson(response.to_string()))
}

// When a player wants to join the game, they must supply a valid game id and their name
// Returns a json with the game id and the generated auth token for this player
// or plain text error if game id is not found or player name in this game already exists
#[get("/join_game/<game_id>/<name>")]
pub async fn join_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let mut players = game.players.lock().unwrap();

        if players.contains(&name.to_string()) {
            Err(BadRequest("Name already exists".to_owned()))
        } else {
            players.push(name.to_string());

            // Tell all other people in the game that a new player has joined
            let mut event: String = NEW_PLAYER_EVENT_PREFIX.to_owned();
            event.push_str(name);
            let _res = game.game_events.send(event.to_string());

            let response = object! {
                gameId: game_id,
                authToken: generate_token(game_id, name.to_string(), game.auth_secret.to_string())
            };
            game.words_per_player.insert(name.to_string(), Vec::new());
        
            Ok(content::RawJson(response.to_string()))
        }
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}

// A player who is not the host can leave the game
// Currently broken - if player has added words and then leaves the game, his words will stay
#[get("/leave_game/<game_id>/<name>")]
pub async fn leave_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let mut players = game.players.lock().unwrap();

        if !players.contains(&name.to_string()) {
            Err(BadRequest("Player not in game".to_owned()))
        } else {
            // remove player, probably exists much easier way
            let mut player_index: usize = 0;
            for i in 0..players.len() {
                if players.get(i).unwrap() == name {
                    player_index = i;
                    break;
                }
            }
            players.remove(player_index);

            // Tell all other people in the game that a player has left
            let mut event: String = PLAYER_LEFT_EVENT_PREFIX.to_owned();
            event.push_str(name);

            let _res = game.game_events.send(event.to_string());
            Ok(content::RawJson(game_id.to_string()))
        }
    } else {
        Err(BadRequest("Game not found".to_owned()))
    }
}