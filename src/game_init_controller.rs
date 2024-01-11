use crate::Game;
use crate::game::init_game;

use chashmap;
use chashmap::CHashMap;
use rand::Rng;

use rocket::State;
use rocket::response::content;

#[get("/create_game/<player_name>/<word_limit>")]
pub fn create_game(player_name: &str, word_limit: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String>{
    let mut rng = rand::thread_rng();

    // Init id
    let mut id: i32 = rng.gen_range(0..100000);
    while games.contains_key(&id) {
        id = rng.gen_range(0..100000);
    }

    let game = init_game(id, player_name, word_limit);
    games.insert(id, game);

    content::RawJson(format!("{}", id))
}

#[get("/join_game/<game_id>/<name>")]
pub async fn join_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        if game.players
            .lock()
            .expect("locked game")
            .contains(&name.to_string()) {

            content::RawJson("Name already exists".to_string())

        } else {
            game.players
                .lock()
                .expect("locked game")
                .push(name.to_string());

            let mut event: String = "new_player:".to_owned();
            event.push_str(name);

            let _res = game.game_events.send(event.to_string());

            content::RawJson(game_id.to_string())

        }
    } else {
        content::RawJson("Game not found".to_string())

    }
}