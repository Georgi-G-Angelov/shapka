use std::path::Path;
use chashmap::CHashMap;
use rocket::{fs::NamedFile, State, response::content};

use crate::game::Game;

#[get("/home")]
pub async fn home() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/home.html")).await.ok()
}

#[get("/join")]
pub async fn join() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/join.html")).await.ok()
}

#[get("/create")]
pub async fn create() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/create.html")).await.ok()
}


#[get("/host/<game_id>/<name>")]
pub async fn host(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name.to_string()) {
        return Option::<NamedFile>::None;
    }
    NamedFile::open(Path::new("static/host.html")).await.ok()
}

#[get("/await/<game_id>/<name>")]
pub async fn await_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name.to_string()) {
        return Option::<NamedFile>::None;
    }
    NamedFile::open(Path::new("static/await.html")).await.ok()
}

#[get("/join_game/<game_id>/<name>")]
pub async fn join_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        if game.players
            .lock()
            .expect("locked game")
            .contains(&name.to_string()) {

            content::RawJson("Name already exists".to_string())

        } else {
            game.players
                .lock()
                .expect("locked game")
                .push(name.to_string());

            let _res = game.queue.send(name.to_string());

            content::RawJson(game_id.to_string())

        }
    } else {
        content::RawJson("Game not found".to_string())

    }
}