use std::sync::Arc;

use rocket::response::status::BadRequest;
use rocket::State;
use rocket::response::content;

use json::object;

use chashmap::CHashMap;

use crate::extentions::arc_string::ArcString;
use crate::models::game::Game;
use crate::constants::*;

use crate::extentions::vec_utils::*;

// Before the start of the game, the players will use this to add words to the game
// Returns a plain text message if the word has been added or if the player has reached their limit
#[get("/add_word/<game_id>/<name>/<word>")]
pub fn add_word<'a>(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let name_arc = ArcString(Arc::new(name.to_string()));
    let word_arc = ArcString(Arc::new(word.to_string()));

    let players = game.players.lock().unwrap();

    if !players.contains(&name_arc.clone()) {
        return Err(BadRequest("Player not in game"));
    }

    // Init number of words added per player if necessary
    let mut num_words_per_player = game.num_words_per_player.lock().unwrap();
    if !num_words_per_player.contains_key(&name_arc) {
        num_words_per_player.insert(name_arc.clone(), 0);
    }

    if num_words_per_player.get(&name_arc.clone()).unwrap() < &game.words_per_player_limit {
        // Add the word
        game.words
            .lock()
            .unwrap()
            .push(word_arc.clone());

        let words_per_player = &mut game.game_state.lock().unwrap().words_per_player;

        let player_words = words_per_player.get_mut(&name_arc).unwrap();
        player_words.push(word_arc);

        let mut event: String = NEW_WORD_EVENT_PREFIX.to_owned();
        event.push_str(&(name.to_owned() + "/" + word));

        let _res = game.game_events.send(event.to_string());

        let curr_words: usize = *num_words_per_player.get(&name_arc).unwrap();
        num_words_per_player.insert(name_arc, curr_words + 1);

        let limit: usize = game.words_per_player_limit;
        let response = object! {
            wordAdded: word,
            wordLimit: limit
        };
        Ok(content::RawJson(response.to_string()))
    } else { 
        Err(BadRequest("You can't add more words"))
    }
}

// Allows players to delete a word they've added before the game starts
// Returns a plain text message if the word has been added or if the player has reached their limit
#[get("/delete_word/<game_id>/<name>/<word>")]
pub fn delete_word<'a>(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> Result<content::RawJson<String>, BadRequest<&'a str>> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Err(BadRequest("Game not found")),
    };
    let name_arc = ArcString(Arc::new(name.to_string()));
    let word_arc = ArcString(Arc::new(word.to_string()));

    // Decrease number of words added per player if necessary
    let mut num_words_per_player: std::sync::MutexGuard<'_, std::collections::HashMap<ArcString, usize>> = game.num_words_per_player.lock().unwrap();
    match num_words_per_player.get_mut(&name_arc) {
        Some(num) => {
            if *num > 0 {

                // Remove the word from player's list
                let words_per_player = &mut game.game_state.lock().unwrap().words_per_player;
                let player_words = words_per_player.get_mut(&name_arc).unwrap();
                if !player_words.remove_element(word_arc.clone()) {
                    return Err(BadRequest("Word not found"));
                }

                // Remove the word from all game words
                let mut game_words = game.words.lock().unwrap();
                game_words.remove_element(word_arc.clone());

                *num -= 1;
            }
            else {
                return Err(BadRequest("Player has no words"));
            }
        },
        None => return Err(BadRequest("Player doesn't exist"))
    };

    // Tell everyone a word was removed
    let mut event: String = WORD_REMOVED_EVENT_PREFIX.to_owned();
    event.push_str(&(name.to_owned() + "/" + word));
    let _res = game.game_events.send(event.to_string());

    let response = object! {
        wordRemoved: word,
        wordLimit: game.words_per_player_limit
    };
    Ok(content::RawJson(response.to_string()))
}