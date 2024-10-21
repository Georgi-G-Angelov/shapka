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
mod extentions;

use rocket::fairing::AdHoc;
use rocket::http::Header;
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
                            join_game, join, host, await_game, in_game, fetch_players, fetch_player_words,
                            game_events, add_word, delete_word, start_game, fetch_game_state, update_timer_state,
                            fetch_word_to_guess, guess_word, undo_last_guess, next_turn, next_round, results, leave_game, forbidden, unauthorized, has_game_started])
        .mount("/", FileServer::from(relative!("static")))
        .attach(authenticator)
        .attach(AdHoc::on_response("No buffering", |_, res| Box::pin(async move {
            let header = Header::new("X-Accel-Buffering", "no"); // We need to return this header from server to make sure SSE works with SSL through nginx
            res.set_header(header);
        })))
}
