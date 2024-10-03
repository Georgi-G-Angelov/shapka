use rocket::response::status::NotFound;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;
use json::object;

use crate::models::game::Game;

// After creating or joining a game, the players will use this to check all players in the game
// Returns a json with the list of players, and the name of the host, or a plain text error message
#[get("/fetch_players/<game_id>")]
pub fn fetch_players<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(NotFound("Game not found")),
    };
    let players = game.players.lock().unwrap();

    let response = object! {
        players: players.to_vec(),
        host: game.host_name.to_owned()
    };

    Ok(content::RawJson(response.dump()))
}

#[get("/fetch_player_words/<game_id>/<name>")]
pub fn fetch_player_words<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(NotFound("Game not found")),
    };
    let words_per_player = &game.game_state.lock().unwrap().words_per_player;
    let words = words_per_player.get(name).unwrap();

    let response = object! {
        words: words.to_vec(),
        host: game.host_name.to_owned()
    };

    Ok(content::RawJson(response.dump()))
}