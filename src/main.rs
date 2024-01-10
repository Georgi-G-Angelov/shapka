#[macro_use] extern crate rocket;

mod game;
use game::*;
mod game_init_controller;
use game_init_controller::*;
mod home_pages_controller;
use home_pages_controller::*;

use rocket::{State, Shutdown, Rocket, Build};
use rocket::fs::{relative, FileServer, NamedFile};
use rocket::response::stream::{EventStream, Event};
use rocket::response::content;
use rocket::tokio::sync::broadcast::{error::RecvError};
use rocket::tokio::select;

use std::path::{Path};

use chashmap::CHashMap;
use string_builder::Builder;

/// Returns an infinite stream of server-sent events.
#[get("/newplayers/<game_id>")]
async fn new_players(game_id: i32, games: &State<CHashMap<i32, Game>>, mut end: Shutdown) -> Option<EventStream![]> {
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

/// Receive a message from a form submission and broadcast it to any receivers.
// #[get("/playerjoined/<game_id>/<name>")]
// fn post_drawing(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) {
//     let game = games.get(&game_id);
//     if game.is_some() {
//         let wb = game.unwrap();
//         // wb.state
//         //         .lock()
//         //         .expect("locked game")
//         //         .push(name.to_string());

//         // A send 'fails' if there are no active subscribers. That's okay.
//         let _res = wb.queue.send(name.to_string());
//     }
// }

// #[get("/create_game/<name>")]
// fn create_game(name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String>{
//     let mut rng = rand::thread_rng();
//     let mut id: i32 = rng.gen_range(0..100000);

//     while games.contains_key(&id) {
//         id = rng.gen_range(0..100000);
//     }
//     let (tx, _) = channel::<String>(1024);
//     let game = Game {
//         id,
//         queue: tx,
//         players: Mutex::new(vec![]),
//         words: Mutex::new(vec![]),
//         num_words_per_player: Mutex::new(HashMap::new())
//     };
//     game.players
//         .lock()
//         .expect("game players locked")
//         .push(name.to_string());
//     games.insert(id, game);


//     content::RawJson(format!("{}", id))
// }

#[get("/add_word/<game_id>/<name>/<word>")]
fn add_word(game_id: i32, name: &str, word: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String>{
    let word_limit: i32 = 4;

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
            .get(name).unwrap() < &word_limit {
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



// #[get("/whiteboard_state/<game_id>")]
// fn whiteboard_state(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Option<content::RawJson<String>>{
//     let game = games.get(&game_id);
//     if game.is_some() {
//         Some(content::RawJson(
//             game.unwrap().state
//                 .lock()
//                 .expect("locked game")
//                 .join(";"))
//         )
//     } else {
//         Option::None
//     }
// }


// #[get("/game/<game_id>")]
// async fn whiteboard_by_id(game_id: i32, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
//     return if games.contains_key(&game_id) {
//         NamedFile::open(Path::new("static/game.html")).await.ok()
//     } else {
//         Option::None
//     };
// }

// #[get("/home")]
// async fn home() -> Option<NamedFile> {
//     NamedFile::open(Path::new("static/home.html")).await.ok()
// }

// #[get("/join")]
// async fn join() -> Option<NamedFile> {
//     NamedFile::open(Path::new("static/join.html")).await.ok()
// }

// #[get("/create")]
// async fn create() -> Option<NamedFile> {
//     NamedFile::open(Path::new("static/create.html")).await.ok()
// }

#[get("/host/<game_id>/<name>")]
async fn host(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
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
async fn await_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> Option<NamedFile> {
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
async fn join_game(game_id: i32, name: &str, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
    if games.contains_key(&game_id) {
        let game = games.get(&game_id).unwrap();
        if game.players
            .lock()
            .expect("locked game")
            .contains(&name.to_string()) {

            // return .to_string();
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

#[get("/fetch_players/<game_id>")]
async fn fetch_players(game_id: i32, games: &State<CHashMap<i32, Game>>) -> content::RawJson<String> {
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


#[launch]
fn rocket() -> Rocket<Build> {
    let games: CHashMap<i32, Game> = CHashMap::new();


    rocket::build()
        .manage(games)
        .mount("/", routes![home, create_game, create,
                            join_game, join, host, await_game, fetch_players,
                            new_players, add_word])
        .mount("/", FileServer::from(relative!("static")))
}
