use rocket::{State, Shutdown};
use rocket::response::stream::{Event, EventStream};
use rocket::tokio::sync::broadcast::error::RecvError;
use rocket::tokio::select;

use chashmap::CHashMap;

use crate::models::game::Game;

/// Returns an infinite stream of server-sent events.
#[get("/gameevents/<game_id>")]
pub async fn game_events(game_id: i32, games: &State<CHashMap<i32, Game>>, mut end: Shutdown) -> Option<EventStream![]> {
    let game = match games.get(&game_id) {
        Some(game) => game,
        None => return Option::None,
    };

    let mut game_events_receiver = game.game_events.subscribe();
    Some(EventStream! {
        loop {
            let msg = select! {
                msg = game_events_receiver.recv() => match msg {
                    Ok(msg) => msg,
                    Err(RecvError::Closed) => break,
                    Err(RecvError::Lagged(_)) => continue,
                },
                _ = &mut end => break,
            };

            yield Event::json(&msg);
        }
    })
}