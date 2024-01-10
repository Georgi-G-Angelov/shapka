use std::sync::Mutex;
use rocket::tokio::sync::broadcast::Sender;
use std::collections::HashMap;

pub struct Game {
    pub id: i32,
    pub game_events: Sender<String>,
    pub players: Mutex<Vec<String>>,
    pub words: Mutex<Vec<String>>,
    pub num_words_per_player: Mutex<HashMap<String, i32>>
}
