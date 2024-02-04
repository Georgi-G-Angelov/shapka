#[macro_use] extern crate rocket;

mod game;
use game::*;
mod game_init_controller;
use game_init_controller::*;
mod home_pages_controller;
use home_pages_controller::*;
mod players_controller;
use players_controller::*;
mod words_controller;
use words_controller::*;
mod game_events_controller;
use game_events_controller::*;
mod turns_controller;
use turns_controller::*;
mod constants;

use rocket::{Rocket, Build};
use rocket::fs::{relative, FileServer};

use chashmap::CHashMap;

#[launch]
fn rocket() -> Rocket<Build> {
    let games: CHashMap<i32, Game> = CHashMap::new();

    rocket::build()
        .manage(games)
        .mount("/", routes![home, create_game, create,
                            join_game, join, host, await_game, in_game, fetch_players,
                            game_events, add_word, start_game, fetch_game_state, update_timer_state,
                            fetch_word_to_guess, guess_word, next_turn, next_round, results])
        .mount("/", FileServer::from(relative!("static")))
}
