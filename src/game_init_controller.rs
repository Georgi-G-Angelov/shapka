use crate::Game;

use chashmap;

use chashmap::CHashMap;
use rand::Rng;

use std::collections::HashMap;
use rocket::State;
use rocket::response::content;
use rocket::tokio::sync::broadcast::channel;

use std::sync::Mutex;

#[get("/create_game/<name>")]
pub fn create_game(name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String>{
    let mut rng = rand::thread_rng();
    let mut id: i32 = rng.gen_range(0..100000);

    while games.contains_key(&id) {
        id = rng.gen_range(0..100000);
    }
    let (tx, _) = channel::<String>(1024);
    let game = Game {
        id,
        game_events: tx,
        players: Mutex::new(vec![]),
        words: Mutex::new(vec![]),
        num_words_per_player: Mutex::new(HashMap::new())
    };
    game.players
        .lock()
        .expect("game players locked")
        .push(name.to_string());
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