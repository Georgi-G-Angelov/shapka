use std::sync::Mutex;
use rocket::tokio::sync::broadcast::Sender;
use serde::Serialize;
use std::collections::HashMap;
use rocket::tokio::sync::broadcast::channel;
use rand::thread_rng;
use rand::seq::SliceRandom;

use crate::constants::TIMER_START_VALUE;

pub struct Game {
    pub id: i32,
    pub game_events: Sender<String>,
    pub players: Mutex<Vec<String>>,
    pub words: Mutex<Vec<String>>,
    pub words_per_player_limit: i32,
    pub num_words_per_player: Mutex<HashMap<String, i32>>,
    pub game_state: Mutex<GameState>
}

#[derive(Serialize)]
pub struct GameState {
    pub timer: i32, // number from 0 to 60000
    pub turn_player: String,
    pub num_words_guessed_per_team: HashMap<i32, i32>,
    pub teams: Vec<Vec<String>>,
    pub teammates: HashMap<String, String>,
    pub team_member_to_team_index: HashMap<String, i32>,
    pub words_guessed: Vec<String>,
    pub words_in_play: Vec<String>, // from 0 to 2 elements
    pub words_to_guess: Vec<String>,
    pub round: i32, // from 0 to 3
    pub is_turn_active: bool
}

pub fn init_game(id: i32, owner_name: &str, words_per_player_limit: i32) -> Game {
    let (tx, _) = channel::<String>(1024);
    let game = Game {
        id,
        game_events: tx,
        players: Mutex::new(vec![]),
        words: Mutex::new(vec![]),
        words_per_player_limit,
        num_words_per_player: Mutex::new(HashMap::new()),
        game_state: Mutex::new(init_game_state())
    };
    game.players
        .lock()
        .expect("game players locked")
        .push(owner_name.to_string());

    return game;
}

pub fn init_game_state() -> GameState {
    return GameState {
        timer: TIMER_START_VALUE,
        turn_player: "".to_string(),
        num_words_guessed_per_team: HashMap::new(),
        teams: Vec::new(),
        teammates: HashMap::new(),
        team_member_to_team_index: HashMap::new(),
        words_guessed: Vec::new(),
        words_in_play: Vec::new(),
        words_to_guess: Vec::new(),
        round: 0,
        is_turn_active: false
    }
}

pub fn init_teams(game_state: &Mutex<GameState>, players: &Mutex<Vec<String>>) {
    players
        .lock()
        .unwrap()
        .shuffle(&mut thread_rng());

    let mut is_first_player_in_team: bool = true;
    let mut current_player: String = "".to_string();
    let mut team_index = 0;
    for player in players.lock().unwrap().iter() {
        if is_first_player_in_team {
            let mut team: Vec<String> = Vec::new();
            team.push(player.to_string());
            game_state.lock().unwrap().teams.push(team);
            is_first_player_in_team = false;
            current_player = player.to_string();
        } else {
            game_state.lock().unwrap()
                .teams
                .last_mut().unwrap()
                .push(player.to_string());
            is_first_player_in_team = true;

            game_state.lock().unwrap().teammates.insert(player.to_string(), current_player.clone());
            game_state.lock().unwrap().teammates.insert(current_player.clone(), player.to_string());
            game_state.lock().unwrap().team_member_to_team_index.insert(player.to_string(), team_index);
            game_state.lock().unwrap().team_member_to_team_index.insert(current_player.clone(), team_index);
            team_index += 1;
        }
    }

    // Set first player of the game
    current_player = game_state.lock().unwrap().teams.get(0).unwrap().get(0).unwrap().to_string();
    game_state.lock().unwrap().turn_player = current_player;


    // For debugging
    for team in game_state.lock().unwrap().teams.iter() {
        for player in team {
            print!("{player}");
            print!(" ");
        }
        println!("");
    }
}