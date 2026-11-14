// End-to-end tests for game settings through the HTTP routes.
use std::collections::HashMap;

use std::net::SocketAddr;

use rocket::http::{Header, Status};
use rocket::local::blocking::Client;
use serde_json::Value;

use super::rocket;

// The rate limiter keys requests by client IP; local test requests have none by default.
fn remote() -> SocketAddr {
    "127.0.0.1:8000".parse().unwrap()
}

struct TestGame {
    client: Client,
    id: i64,
    tokens: HashMap<String, String>,
}

impl TestGame {
    fn get(&self, uri: &str, player: &str) -> (Status, String) {
        let response = self.client.get(uri.to_string())
            .remote(remote())
            .header(Header::new("Authorization", self.tokens[player].clone()))
            .dispatch();
        let status = response.status();
        (status, response.into_string().unwrap_or_default())
    }

    fn state(&self) -> Value {
        let host = self.tokens.keys().next().unwrap().clone();
        let (status, body) = self.get(&format!("/fetch_game_state/{}", self.id), &host);
        assert_eq!(status, Status::Ok, "{}", body);
        serde_json::from_str(&body).unwrap()
    }

    fn turn_player(&self) -> String {
        self.state()["turn_player"].as_str().unwrap().to_string()
    }

    // The turn player explains every word in the hat.
    fn play_out_round(&self) {
        let player = self.turn_player();
        loop {
            let state = self.state();
            if state["words_in_play"].as_array().unwrap().is_empty() && state["words_to_guess"].as_array().unwrap().is_empty() {
                break;
            }
            let (_, word) = self.get(&format!("/fetch_word/{}/{}", self.id, player), &player);
            let word = if state["words_in_play"].as_array().unwrap().is_empty() { word } else { state["words_in_play"][0].as_str().unwrap().to_string() };
            let (status, body) = self.get(&format!("/guess_word/{}/{}/{}", self.id, player, word), &player);
            assert_eq!(status, Status::Ok, "{}", body);
        }
    }
}

fn create(client: &Client, uri: &str) -> (Status, String) {
    let response = client.get(uri.to_string()).remote(remote()).dispatch();
    let status = response.status();
    (status, response.into_string().unwrap_or_default())
}

// Host "ana" creates a game at `create_uri`, "bobi" joins, both add 4 words and the game starts.
fn started_game(create_uri: &str) -> TestGame {
    let client = Client::tracked(rocket()).expect("valid rocket instance");
    let (status, body) = create(&client, create_uri);
    assert_eq!(status, Status::Ok, "{}", body);
    let created: Value = serde_json::from_str(&body).unwrap();
    let id = created["gameId"].as_i64().unwrap();
    let mut tokens = HashMap::new();
    tokens.insert("ana".to_string(), created["authToken"].as_str().unwrap().to_string());
    let (status, body) = create(&client, &format!("/join_game/{}/bobi", id));
    assert_eq!(status, Status::Ok, "{}", body);
    let joined: Value = serde_json::from_str(&body).unwrap();
    tokens.insert("bobi".to_string(), joined["authToken"].as_str().unwrap().to_string());

    let game = TestGame { client, id, tokens };
    for player in ["ana", "bobi"] {
        for word in ["a", "b", "c", "d"] {
            let (status, body) = game.get(&format!("/add_word/{}/{}/{}{}", id, player, player, word), player);
            assert_eq!(status, Status::Ok, "{}", body);
        }
    }
    let (status, body) = game.get(&format!("/start_game/{}", id), "ana");
    assert_eq!(status, Status::Ok, "{}", body);
    game
}

#[test]
fn the_original_route_keeps_sixty_second_turns_and_all_three_rounds() {
    let game = started_game("/create_game/ana/4");
    let state = game.state();
    assert_eq!(state["turn_length"], 60000);
    assert_eq!(state["timer"], 60000);
    assert_eq!(state["rounds"], serde_json::json!([1, 2, 3]));
}

#[test]
fn invalid_settings_are_rejected() {
    let client = Client::tracked(rocket()).expect("valid rocket instance");
    for uri in ["/create_game/ana/4/50/123", "/create_game/ana/4/60/4", "/create_game/ana/4/60/0", "/create_game/ana/4/60/x"] {
        let (status, _) = create(&client, uri);
        assert_eq!(status, Status::BadRequest, "{}", uri);
    }
}

#[test]
fn turns_reset_to_the_chosen_length_and_the_last_chosen_round_ends_the_game() {
    let game = started_game("/create_game/ana/4/30/31");
    let state = game.state();
    assert_eq!(state["turn_length"], 30000);
    assert_eq!(state["timer"], 30000);
    assert_eq!(state["rounds"], serde_json::json!([1, 3]));

    // A new turn starts with the chosen length.
    let (status, _) = game.get(&format!("/update_timer_state/{}/0/false/true/1", game.id), "ana");
    assert_eq!(status, Status::Ok);
    let (status, _) = game.get(&format!("/next_turn/{}", game.id), "ana");
    assert_eq!(status, Status::Ok);
    assert_eq!(game.state()["timer"], 30000);

    // Round 1 of 2. A new explainer in the next round also gets the chosen length.
    game.play_out_round();
    assert_eq!(game.state()["is_game_finished"], false);
    let (status, _) = game.get(&format!("/update_timer_state/{}/500/false/false/1", game.id), "ana");
    assert_eq!(status, Status::Ok);
    let (status, body) = game.get(&format!("/next_round/{}", game.id), "ana");
    assert_eq!(status, Status::Ok, "{}", body);
    let state = game.state();
    assert_eq!(state["round"], 2);
    assert_eq!(state["timer"], 30000);

    // Round 2 of 2 is the last one.
    game.play_out_round();
    let state = game.state();
    assert_eq!(state["is_game_finished"], true);
    assert_eq!(state["words_guessed_per_team_per_round"]["2"]["0"].as_array().unwrap().len(), 8);
    let (status, body) = game.get(&format!("/next_round/{}", game.id), "ana");
    assert_eq!(status, Status::BadRequest, "{}", body);
}

#[test]
fn a_single_round_game_finishes_after_its_only_round() {
    let game = started_game("/create_game/ana/4/120/2");
    assert_eq!(game.state()["rounds"], serde_json::json!([2]));
    game.play_out_round();
    assert_eq!(game.state()["is_game_finished"], true);
    let (status, _) = game.get(&format!("/next_round/{}", game.id), "ana");
    assert_eq!(status, Status::BadRequest);
}
