use rocket::{State, Shutdown};
use rocket::response::stream::{Event, EventStream};
use rocket::response::content;
use rocket::tokio::sync::broadcast::error::RecvError;
use rocket::tokio::select;

use chashmap::CHashMap;
use string_builder::Builder;

use crate::game::Game;

/// Returns an infinite stream of server-sent events.
#[get("/newplayers/<game_id>")]
pub async fn new_players(game_id: i32, games: &State<CHashMap<i32, Game>>, mut end: Shutdown) -> Option<EventStream![]> {
    if !games.contains_key(&game_id) {
        return Option::None;
    }

    let game = games.get(&game_id);

    let mut rx = game.unwrap().queue.subscribe();
    Some(EventStream! {
        loop {
            let msg = select! {
                msg = rx.recv() => match msg {
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

#[get("/fetch_players/<game_id>")]
pub async fn fetch_players(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        let mut builder = Builder::default();
        
        let players = game.players.lock().expect("locked players");

        for i in 0..players.len() {
            builder.append(players[i].as_str());
            if i < players.len() - 1 {
                builder.append(",");
            }
        }
        
        content::RawJson(builder.string().unwrap())

        
    } else {
        content::RawJson("Game not found".to_string())
    }
}