use crate::Game;
use crate::game::init_game;
use crate::constants::*;

use chashmap;
use chashmap::CHashMap;
use rand::Rng;

use rocket::response::status::BadRequest;
use rocket::State;
use rocket::response::content;

#[get("/create_game/<player_name>/<word_limit>")]
pub fn create_game(player_name: &str, word_limit: i32, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>>{
    let mut rng = rand::thread_rng();

    if word_limit < MIN_WORDS_PER_PLAYER || word_limit > MAX_WORDS_PER_PLAYER {
        error!("Word limit per player is either too high or too low.");
        return Err(BadRequest(Some("Word limit per player is either too high or too low.".to_owned())));
    }

    // Init id
    let mut id: i32 = rng.gen_range(0..MAX_GAME_ID);
    while games.contains_key(&id) {
        id = rng.gen_range(0..MAX_GAME_ID);
    }

    let game = init_game(id, player_name, word_limit);
    games.insert(id, game);

    Ok(content::RawJson(format!("{}",id)))
}

#[get("/join_game/<game_id>/<name>")]
pub async fn join_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        if game.players
            .lock()
            .expect("locked game")
            .contains(&name.to_string()) {

            Err(BadRequest(Some("Name already exists".to_owned())))
        } else {
            game.players
                .lock()
                .expect("locked game")
                .push(name.to_string());

            let mut event: String = NEW_PLAYER_EVENT_PREFIX.to_owned();
            event.push_str(name);

            let _res = game.game_events.send(event.to_string());

            Ok(content::RawJson(game_id.to_string()))

        }
    } else {
        Err(BadRequest(Some("Game not found".to_owned())))
    }
}