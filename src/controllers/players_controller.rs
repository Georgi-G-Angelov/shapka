use rocket::response::status::NotFound;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;
use json::object;

use crate::models::game::Game;

#[get("/fetch_players/<game_id>")]
pub async fn fetch_players(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
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