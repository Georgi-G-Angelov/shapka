#[macro_use] extern crate rocket;

mod auth;
use auth::authenticator::*;
mod models;
use auth::utils::*;
use models::game::*;
mod controllers;
use controllers::game_events_controller::*;
use controllers::game_init_controller::*;
use controllers::pages_controller::*;
use controllers::players_controller::*;
use controllers::turns_controller::*;
use controllers::words_controller::*;
mod constants;

use rocket::{Rocket, Build};
use rocket::fs::{relative, FileServer};

use chashmap::CHashMap;

#[launch]
fn rocket() -> Rocket<Build> {
    let games: CHashMap<i32, Game> = CHashMap::new();
    let authenticator = Authenticator::new();

    rocket::build()
        .manage(games)
        .mount("/", routes![home, create_game, create,
                            join_game, join, host, await_game, in_game, fetch_players,
                            game_events, add_word, start_game, fetch_game_state, update_timer_state,
                            fetch_word_to_guess, guess_word, next_turn, next_round, results, leave_game, forbidden, unauthorized, authorize])
        .mount("/", FileServer::from(relative!("static")))
        .attach(authenticator)
}
