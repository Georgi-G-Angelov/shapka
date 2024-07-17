use std::sync::Mutex;
use rocket::tokio::sync::broadcast::Sender;
use serde::Serialize;
use std::collections::HashMap;
use rocket::tokio::sync::broadcast::channel;
use rand::thread_rng;
use rand::seq::SliceRandom;
use guid_create::GUID;

use crate::constants::{NUM_ROUNDS, TIMER_START_VALUE};

// Basic struct for a game, mostly used before a game has started
pub struct Game {
    pub id: i32,
    pub game_events: Sender<String>,
    pub players: Mutex<Vec<String>>,
    pub words: Mutex<Vec<String>>,
    pub words_per_player_limit: usize,
    pub num_words_per_player: Mutex<HashMap<String, usize>>,
    pub game_state: Mutex<GameState>,
    pub host_name: String,
    pub auth_secret: String
}

// State of a game with all details needed to run the turns
#[derive(Serialize)]
pub struct GameState {
    pub timer: i32, // number from 0 to TIMER_START_VALUE
    pub turn_player: String,
    pub turn_player_index: usize,
    pub words_guessed_per_team_per_round: HashMap<i32, HashMap<i32, Vec<String>>>,
    pub words_per_player: HashMap<String, Vec<String>>,
    pub teams: Vec<Vec<String>>,
    pub teammates: HashMap<String, String>,
    pub team_member_to_team_index: HashMap<String, i32>,
    pub player_rotation: Vec<String>,
    pub words_guessed: Vec<String>,
    pub words_in_play: Vec<String>, // from 0 to 2 elements
    pub words_to_guess: Vec<String>,
    pub round: i32, // from 1 to 3
    pub is_turn_active: bool,
    pub is_round_active: bool,
    pub is_game_finished: bool,
    pub has_game_started: bool
}

// Initialize game with the owner (host) name and a word limit per player
pub fn init_game(id: i32, owner_name: &str, words_per_player_limit: usize) -> Game {
    let (tx, _) = channel::<String>(1024);
    let game = Game {
        id,
        game_events: tx,
        players: Mutex::new(vec![]),
        words: Mutex::new(vec![]),
        words_per_player_limit,
        num_words_per_player: Mutex::new(HashMap::new()),
        game_state: Mutex::new(init_game_state()),
        host_name: owner_name.to_owned(),
        auth_secret: GUID::rand().to_string() // generate random string to use for auth tokens for players
    };
    game.players
        .lock()
        .expect("game players locked")
        .push(owner_name.to_string());

    game.game_state.lock().unwrap().words_per_player.insert(owner_name.to_string().clone(), Vec::new());

    return game;
}

// Initialize the game state
pub fn init_game_state() -> GameState {
    let mut words_guessed_per_team_per_round: HashMap<i32, HashMap<i32, Vec<String>>> = HashMap::new();
    for i in 1..NUM_ROUNDS+1 {
        words_guessed_per_team_per_round.insert(i, HashMap::new());
    }

    let mut words_per_player: HashMap<String, Vec<String>> = HashMap::new();

    return GameState {
        timer: TIMER_START_VALUE,
        turn_player: "".to_string(),
        turn_player_index: 0,
        words_guessed_per_team_per_round,
        words_per_player,
        teams: Vec::new(),
        teammates: HashMap::new(),
        team_member_to_team_index: HashMap::new(),
        player_rotation: Vec::new(),
        words_guessed: Vec::new(),
        words_in_play: Vec::new(),
        words_to_guess: Vec::new(),
        round: 1,
        is_turn_active: false,
        is_round_active: true,
        is_game_finished: false,
        has_game_started: false
    }
}

// Initialize the teams given a list of players
pub fn init_teams(game_state: &Mutex<GameState>, players: &Mutex<Vec<String>>) {

    // start game - since this is called when the game starts, we also mark it as started here
    game_state.lock().unwrap().has_game_started = true;

    // shuffle players
    players
        .lock()
        .unwrap()
        .shuffle(&mut thread_rng());

    // each team has a first and second player
    let mut first_players: Vec<String> = Vec::new();
    let mut second_players: Vec<String> = Vec::new();

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

            first_players.push(player.to_string());
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

            second_players.push(player.to_string());
        }
    }

    // Set first player of the game
    game_state.lock().unwrap().player_rotation.append(&mut first_players);
    game_state.lock().unwrap().player_rotation.append(&mut second_players);
    let starting_player = game_state.lock().unwrap().player_rotation.get(0).unwrap().to_string();
    game_state.lock().unwrap().turn_player = starting_player;
    game_state.lock().unwrap().turn_player_index = 0;


    // For debugging
    for team in game_state.lock().unwrap().teams.iter() {
        for player in team {
            print!("{player}");
            print!(" ");
        }
        println!("");
    }
}