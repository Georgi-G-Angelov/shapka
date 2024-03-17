use rocket::response::status::BadRequest;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;

use crate::models::game::Game;

#[get("/add_word/<game_id>/<name>/<word>")]
pub fn add_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    let game = games.get(&game_id).unwrap();
    let mut num_words_per_player = game.num_words_per_player.lock().unwrap();
    if !num_words_per_player.contains_key(name) {
        num_words_per_player.insert(name.to_string(), 0);
    }

    if num_words_per_player.get(name).unwrap() < &game.words_per_player_limit {
        game.words
            .lock()
            .unwrap()
            .push(word.to_string());

        let curr_words: usize = *num_words_per_player.get(name).unwrap();
        num_words_per_player.insert(name.to_string(), curr_words + 1);

        Ok(content::RawJson("Word added: ".to_owned() + word))
    } else {
        Err(BadRequest(Some("You can't add more words".to_owned())))
    }
}