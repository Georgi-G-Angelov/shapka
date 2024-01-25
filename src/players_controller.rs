use rocket::response::status::NotFound;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;
use string_builder::Builder;

use crate::game::Game;

#[get("/fetch_players/<game_id>")]
pub async fn fetch_players(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, NotFound<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let mut builder = Builder::default();
        
        let players = game.players.lock().unwrap();

        for i in 0..players.len() {
            builder.append(players[i].as_str());
            if i < players.len() - 1 {
                builder.append(",");
            }
        }
        
        Ok(content::RawJson(builder.string().unwrap()))
    } else {
        Err(NotFound("Game not found".to_owned()))
    }
}