use std::sync::{Mutex, Arc};
use rocket::tokio::sync::broadcast::Sender;
use serde::Serialize;
use std::collections::HashMap;
use rocket::tokio::sync::broadcast::channel;
use rand::thread_rng;
use rand::seq::SliceRandom;
use guid_create::GUID;

use crate::constants::{ALLOWED_TURN_SECONDS, NUM_ROUNDS};
use crate::extentions::arc_string::ArcString;

// Basic struct for a game, mostly used before a game has started
pub struct Game {
    pub id: i32,
    pub game_events: Sender<String>,
    pub players: Mutex<Vec<ArcString>>,
    pub words: Mutex<Vec<ArcString>>,
    pub words_per_player_limit: usize,
    pub num_words_per_player: Mutex<HashMap<ArcString, usize>>,
    pub game_state: Mutex<GameState>,
    pub host_name: ArcString,
    pub auth_secret: String
}

// State of a game with all details needed to run the turns
#[derive(Serialize)]
pub struct GameState {
    pub timer: i32, // number from 0 to turn_length
    pub turn_length: i32, // milliseconds per turn, chosen by the host
    pub rounds: Vec<i32>, // round kinds played, in order, e.g. [1, 3]; `round` is a 1-based position in this list
    pub turn_player: ArcString,
    pub turn_player_index: usize,
    pub words_guessed_per_team_per_round: HashMap<i32, HashMap<i32, Vec<ArcString>>>,
    pub words_per_player: HashMap<ArcString, Vec<ArcString>>,
    pub teams: Vec<Vec<ArcString>>,
    pub teammates: HashMap<ArcString, ArcString>,
    pub team_member_to_team_index: HashMap<ArcString, i32>,
    pub player_rotation: Vec<ArcString>,
    pub words_guessed: Vec<ArcString>,
    pub words_in_play: Vec<ArcString>, // from 0 to 2 elements
    pub words_to_guess: Vec<ArcString>,
    pub round: i32, // from 1 to rounds.len()
    pub is_turn_active: bool,
    pub is_round_active: bool,
    pub is_game_finished: bool,
    pub has_game_started: bool
}

// Initialize game with the owner (host) name, a word limit per player, the turn length and the rounds to play
pub fn init_game(id: i32, owner_name: &str, words_per_player_limit: usize, turn_length: i32, rounds: Vec<i32>) -> Game {
    let (tx, _) = channel::<String>(1024);
    let owner_arc = Arc::new(owner_name.to_string());
    let owner_name = ArcString(owner_arc);
    
    let game = Game {
        id,
        game_events: tx,
        players: Mutex::new(vec![owner_name.clone()]),
        words: Mutex::new(vec![]),
        words_per_player_limit,
        num_words_per_player: Mutex::new(HashMap::new()),
        game_state: Mutex::new(init_game_state(owner_name.clone(), turn_length, rounds)),
        host_name: owner_name.clone(),
        auth_secret: GUID::rand().to_string() // generate random string to use for auth tokens for players
    };

    game.game_state.lock().unwrap().words_per_player.insert(owner_name.clone(), Vec::new());

    game
}

// Turn length in seconds -> milliseconds, if it is one of the allowed values
pub fn parse_turn_seconds(turn_seconds: i32) -> Result<i32, String> {
    if ALLOWED_TURN_SECONDS.contains(&turn_seconds) {
        Ok(turn_seconds * 1000)
    } else {
        Err(format!("Turn length must be one of {:?} seconds", ALLOWED_TURN_SECONDS))
    }
}

// Rounds to play as digits, e.g. "13" -> [1, 3]. Each digit is a round kind from 1 to NUM_ROUNDS.
// Rounds are always played in ascending order and at most once, so "31" and "113" also mean [1, 3].
pub fn parse_rounds(rounds: &str) -> Result<Vec<i32>, String> {
    let mut parsed: Vec<i32> = Vec::new();
    for c in rounds.chars() {
        let kind = c.to_digit(10)
            .map(|d| d as i32)
            .filter(|d| *d >= 1 && *d <= NUM_ROUNDS)
            .ok_or_else(|| format!("Rounds must be digits from 1 to {}", NUM_ROUNDS))?;
        if !parsed.contains(&kind) {
            parsed.push(kind);
        }
    }
    if parsed.is_empty() {
        return Err("Pick at least one round".to_string());
    }
    parsed.sort();
    Ok(parsed)
}

// Initialize the game state
pub fn init_game_state(owner_name: ArcString, turn_length: i32, rounds: Vec<i32>) -> GameState {
    let mut words_guessed_per_team_per_round: HashMap<i32, HashMap<i32, Vec<ArcString>>> = HashMap::new();
    for i in 1..rounds.len() as i32 + 1 {
        words_guessed_per_team_per_round.insert(i, HashMap::new());
    }

    let mut words_per_player: HashMap<ArcString, Vec<ArcString>> = HashMap::new();
    words_per_player.insert(owner_name.clone(), Vec::new());

    GameState {
        timer: turn_length,
        turn_length,
        rounds,
        turn_player: owner_name.clone(),
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
pub fn init_teams(game_state: &Mutex<GameState>, players: &Mutex<Vec<ArcString>>) {
    let mut game_state = game_state.lock().unwrap();

    // start game - since this is called when the game starts, we also mark it as started here
    game_state.has_game_started = true;

    // shuffle players
    players
        .lock()
        .unwrap()
        .shuffle(&mut thread_rng());

    // each team has a first and second player
    let mut first_players: Vec<ArcString> = Vec::new();
    let mut second_players: Vec<ArcString> = Vec::new();

    let mut is_first_player_in_team: bool = true;
    let mut current_player: ArcString = ArcString(Arc::new(String::new()));
    let mut team_index = 0;
    for player in players.lock().unwrap().iter() {
        if is_first_player_in_team {
            let mut team: Vec<ArcString> = Vec::new();
            team.push(player.clone());
            game_state.teams.push(team);
            is_first_player_in_team = false;
            current_player = player.clone();

            first_players.push(player.clone());
        } else {
            game_state
                .teams
                .last_mut().unwrap()
                .push(player.clone());
            is_first_player_in_team = true;

            game_state.teammates.insert(player.clone(), current_player.clone());
            game_state.teammates.insert(current_player.clone(), player.clone());
            game_state.team_member_to_team_index.insert(player.clone(), team_index);
            game_state.team_member_to_team_index.insert(current_player.clone(), team_index);
            team_index += 1;

            second_players.push(player.clone());
        }
    }

    // Set first player of the game
    game_state.player_rotation.append(&mut first_players);
    game_state.player_rotation.append(&mut second_players);
    let starting_player = game_state.player_rotation.get(0).unwrap().clone();
    game_state.turn_player = starting_player;
    game_state.turn_player_index = 0;

    // For debugging
    for team in game_state.teams.iter() {
        for player in team {
            print!("{}", player);
            print!(" ");
        }
        println!("");
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turn_seconds_must_be_an_allowed_value() {
        assert_eq!(parse_turn_seconds(45), Ok(45000));
        assert_eq!(parse_turn_seconds(120), Ok(120000));
        assert!(parse_turn_seconds(50).is_err());
        assert!(parse_turn_seconds(0).is_err());
        assert!(parse_turn_seconds(-60).is_err());
    }

    #[test]
    fn rounds_are_sorted_deduplicated_and_non_empty() {
        assert_eq!(parse_rounds("123"), Ok(vec![1, 2, 3]));
        assert_eq!(parse_rounds("31"), Ok(vec![1, 3]));
        assert_eq!(parse_rounds("2"), Ok(vec![2]));
        assert_eq!(parse_rounds("3113"), Ok(vec![1, 3]));
        assert!(parse_rounds("").is_err());
        assert!(parse_rounds("0").is_err());
        assert!(parse_rounds("14").is_err());
        assert!(parse_rounds("1a").is_err());
    }

    #[test]
    fn game_state_uses_the_chosen_turn_length_and_rounds() {
        let state = init_game_state(ArcString(Arc::new("host".to_string())), 30000, vec![1, 3]);
        assert_eq!(state.timer, 30000);
        assert_eq!(state.turn_length, 30000);
        assert_eq!(state.rounds, vec![1, 3]);
        let mut round_keys: Vec<&i32> = state.words_guessed_per_team_per_round.keys().collect();
        round_keys.sort();
        assert_eq!(round_keys, vec![&1, &2]);
    }
}
