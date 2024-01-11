use std::sync::Mutex;
use rocket::tokio::sync::broadcast::Sender;
use std::collections::HashMap;
use rocket::tokio::sync::broadcast::channel;

pub struct Game {
    pub id: i32,
    pub game_events: Sender<String>,
    pub players: Mutex<Vec<String>>,
    pub words: Mutex<Vec<String>>,
    pub words_per_player_limit: i32,
    pub num_words_per_player: Mutex<HashMap<String, i32>>
}

pub fn init_game(id: i32, owner_name: &str, words_per_player_limit: i32) -> Game {
    let (tx, _) = channel::<String>(1024);
    let game = Game {
        id,
        game_events: tx,
        players: Mutex::new(vec![]),
        words: Mutex::new(vec![]),
        words_per_player_limit,
        num_words_per_player: Mutex::new(HashMap::new())
    };
    game.players
        .lock()
        .expect("game players locked")
        .push(owner_name.to_string());

    return game;
}