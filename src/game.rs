use std::sync::Mutex;
use rocket::tokio::sync::broadcast::{Sender};
use rocket::serde::{Serialize, Deserialize};


#[derive(Debug, Clone, FromForm, Serialize, Deserialize)]
#[cfg_attr(test, derive(PartialEq, UriDisplayQuery))]
#[serde(crate = "rocket::serde")]
pub struct Message {
    #[field(validate = len(..20))]
    pub username: String,
    pub message: String,
}

pub struct Game {
    pub id: i32,
    pub queue: Sender<Message>,
    pub players: Mutex<Vec<String>>,
    pub words: Mutex<Vec<String>>
}
