use json::object;
use rocket::response::status::BadRequest;
use rocket::response::content;
use rocket::State;

use chashmap::CHashMap;

use crate::models::game::Game;

// Used for the front end to check if game has started every X seconds, in case anyone misses the "game_start" event
// Returns plain text true or false, or error message
#[get("/has_game_started/<game_id>")]
pub async fn has_game_started<'a>(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let has_game_started = &game.game_state.lock().unwrap().has_game_started;

    Ok(content::RawJson(has_game_started.to_string()))
}

// Used for the front end to check if the player has an active game,
// in case someone goes to home page because they are drunk, but still have the game id, their name and token saved on the front end
// Returns plain text true or false, or error message
#[get("/is_in_game/<game_id>/<name>")]
pub async fn is_in_game<'a>(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };

    if !game.players.lock().unwrap().contains(&name.to_string()) {
        return Err(BadRequest("Player does not exist in game"));
    };

    let game_state = &game.game_state.lock().unwrap();
    let is_game_active = game_state.has_game_started && !game_state.is_game_finished;
    let is_host = game.host_name == name.to_string();

    let response = object! {
        isGameActive: is_game_active.to_string(),
        isHost: is_host.to_string()
    };

    Ok(content::RawJson(response.to_string()))
}