use rocket::response::content;
use rocket::State;
use serde_json;

use chashmap::CHashMap;

use crate::game::{Game, init_teams};

#[get("/start_game/<game_id>")]
pub async fn start_game(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let game_state = &game.game_state;
        let players = &game.players;

        init_teams(game_state, players);

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
