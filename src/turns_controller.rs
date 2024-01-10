use rocket::response::content;
use rocket::{State, Shutdown};
use rocket::response::stream::{Event, EventStream};
use rocket::tokio::sync::broadcast::error::RecvError;
use rocket::tokio::select;

use chashmap::CHashMap;

use crate::game::Game;

#[get("/start_game/<game_id>")]
pub async fn start_game(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();

            let mut event: String = "start_game".to_owned();
            let _res = game.game_events.send(event.to_string());

            content::RawJson(game_id.to_string())

    } else {
        content::RawJson("Game not found".to_string())
    }
}