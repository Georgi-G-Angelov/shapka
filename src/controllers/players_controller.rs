use rocket::response::status::NotFound;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;
use json::object;

use crate::models::game::Game;

// After creating or joining a game, the players will use this to check all players in the game
// Returns a json with the list of players, and the name of the host, or a plain text error message
#[get("/fetch_players/<game_id>")]
pub fn fetch_players(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let players = game.players.lock().unwrap();

        let response = object! {
            players: players.to_vec(),
            host: game.host_name.to_owned()
        };

        Ok(content::RawJson(response.dump()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}

#[get("/fetch_player_words/<game_id>/<name>")]
pub fn fetch_player_words(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let words_per_player = &game.words_per_player;
        let words = words_per_player.get(name).unwrap();

        let response = object! {
            words: words.to_vec(),
            host: game.host_name.to_owned()
        };

        Ok(content::RawJson(response.dump()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}