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