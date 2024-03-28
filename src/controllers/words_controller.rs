use rocket::response::status::BadRequest;
use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;

use crate::models::game::Game;

// Before the start of the game, the players will use this to add words to the game
// Returns a plain text message if the word has been added or if the player has reached their limit
#[get("/add_word/<game_id>/<name>/<word>")]
pub fn add_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<String>> {
    let game = games.get(&game_id).unwrap();

    // Init number of words added per player if necessary
    let mut num_words_per_player = game.num_words_per_player.lock().unwrap();
    if !num_words_per_player.contains_key(name) {
        num_words_per_player.insert(name.to_string(), 0);
    }

    if num_words_per_player.get(name).unwrap() < &game.words_per_player_limit {
        // Add the word
        game.words
            .lock()
            .unwrap()
            .push(word.to_string());

        // Update num words per player
        let curr_words: usize = *num_words_per_player.get(name).unwrap();
        num_words_per_player.insert(name.to_string(), curr_words + 1);

        Ok(content::RawJson("Word added: ".to_owned() + word))
    } else {
        Err(BadRequest("You can't add more words".to_owned()))
    }
}