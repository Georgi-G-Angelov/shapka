use std::{path::Path, sync::Arc};
use chashmap::CHashMap;
use rocket::{fs::NamedFile, State};

use crate::{extentions::arc_string::ArcString, models::game::Game};

#[get("/")]
pub async fn home() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/html/home.html")).await.ok()
}

#[get("/join")]
pub async fn join() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/html/join.html")).await.ok()
}

#[get("/create")]
pub async fn create() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/html/create.html")).await.ok()
}

#[get("/host/<game_id>/<name>")]
pub async fn host(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    let name_arc = ArcString(Arc::new(name.to_string()));

    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name_arc) {
        return Option::<NamedFile>::None;
    }
    if game.game_state.lock().unwrap().is_game_finished {
        return NamedFile::open(Path::new("static/html/results.html")).await.ok();
    }
    NamedFile::open(Path::new("static/html/host.html")).await.ok()
}

#[get("/await/<game_id>/<name>")]
pub async fn await_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    let name_arc = ArcString(Arc::new(name.to_string()));
    
    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name_arc) {
        return Option::<NamedFile>::None;
    }
    if game.game_state.lock().unwrap().is_game_finished {
        return NamedFile::open(Path::new("static/html/results.html")).await.ok();
    }
    NamedFile::open(Path::new("static/html/await.html")).await.ok()
}

#[get("/game/<game_id>/<name>")]
pub async fn in_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    let name_arc = ArcString(Arc::new(name.to_string()));
    
    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name_arc) {
        return Option::<NamedFile>::None;
    }
    NamedFile::open(Path::new("static/html/game.html")).await.ok()
}

#[get("/results/<game_id>/<name>")]
pub async fn results(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
    if !games.contains_key(&game_id) {
        error!("Game does not exist");
        return Option::<NamedFile>::None;
    }
    let game = games.get(&game_id).unwrap();
    let name_arc = ArcString(Arc::new(name.to_string()));
    
    if !game.players
        .lock()
        .expect("locked game")
        .contains(&name_arc) {
        return Option::<NamedFile>::None;
    }
    NamedFile::open(Path::new("static/html/results.html")).await.ok()
}