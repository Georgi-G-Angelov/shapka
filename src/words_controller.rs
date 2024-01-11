use rocket::State;
use rocket::response::content;

use chashmap::CHashMap;

use crate::game::Game;

#[get("/add_word/<game_id>/<name>/<word>")]
pub fn add_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String>{
    
    let game = games.get(&game_id).unwrap();
    if !game.num_words_per_player
            .lock()
            .expect("locked num words per player")
            .contains_key(name) {
        game.num_words_per_player
            .lock()
            .expect("locked num words per player")
            .insert(name.to_string(), 0);
    }

    let game = games.get(&game_id).unwrap();

    if game.num_words_per_player
            .lock()
            .expect("locked num words per player")
            .get(name).unwrap() < &game.words_per_player_limit {
        game.words
            .lock()
            .expect("List of words locked")
            .push(word.to_string());

        let curr_words: i32 = *game.num_words_per_player
                                .lock()
                                .expect("locked num words per player")
                                .get(name).unwrap();

        game.num_words_per_player
            .lock()
            .expect("locked num words per player")
            .insert(name.to_string(), curr_words + 1);

        println!("{}", game.num_words_per_player
            .lock()
            .expect("locked num words per player")
            .get(name).unwrap());

        content::RawJson("Word added: ".to_owned() + word)
    } else {
        content::RawJson("You can't add more words".to_string())
    }
}