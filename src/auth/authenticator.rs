use std::collections::HashSet;

use chashmap::CHashMap;
use rocket::{fairing::{Fairing, Info, Kind}, http::{hyper::header::AUTHORIZATION, uri::Origin}, serde::json::from_str, Data, Request};

use crate::{Game, AUTHORIZATION_HEADER_NAME};

use super::utils::{authorize_token, FORBIDDEN_URI, UNAUTHORIZED_URI};

pub(crate) struct Authenticator {
    auth_endpoints_with_player_name: HashSet<String>,
    auth_endpoints_without_player_name: HashSet<String>
}

impl Authenticator {
    pub fn new() -> Self {
        // Make sure uri's for 403 and 401 requests are fine
        let _forbidden = Origin::parse(FORBIDDEN_URI).unwrap();
        let _unauthorized = Origin::parse(UNAUTHORIZED_URI).unwrap();

        // Not the cleanest initialization buuut anyway
        let endpoints_with_player_name_vec = vec![
            "add_word",
            "delete_word",
            "authorize",
            "leave_game",
            "fetch_word",
            "guess_word",
            "host",
            "await",
            "game",
            "is_game_active",
            "kick_player"
        ];
        let auth_endpoints_with_player_name: HashSet<String> =
            HashSet::from_iter(
                endpoints_with_player_name_vec
                .iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>()
            );
        let endpoints_without_player_name_vec = vec![
            "fetch_players",
            "start_game",
            "fetch_game_state",
            "update_timer_state",
            "next_turn",
            "next_round",
            "has_game_started"
        ];
        let auth_endpoints_without_player_name: HashSet<String> =
            HashSet::from_iter(
                endpoints_without_player_name_vec
                .iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>()
            );

        Self {
            auth_endpoints_with_player_name,
            auth_endpoints_without_player_name
        }
    }
}

#[rocket::async_trait]
impl Fairing for Authenticator {
    fn info(&self) -> Info {
        Info {
            name: "Authenticator fairing",
            kind: Kind::Request
        }
    }

    async fn on_request(&self, request: &mut Request<'_>, _: &mut Data<'_>) {
        let games = request.rocket().state::<CHashMap<i32, Game>>().expect("Authenticator fairing cannot find global state 'games'");

        let maybe_endpoint = request.uri().path().segments().get(0);
        if !maybe_endpoint.is_some() { //home endpoint / doesn't need auth
            return;
        } else {
            let should_authorize_player_name = self.auth_endpoints_with_player_name.contains(maybe_endpoint.unwrap());
            if !should_authorize_player_name && !self.auth_endpoints_without_player_name.contains(maybe_endpoint.unwrap()) {
                return;
            }

            // All endpoints that need to be authenticated must be of the form /<endpoint>/<game_id>/<player_name>
            let endpoint = maybe_endpoint.unwrap();
            let game_id_str = request.uri().path().segments().get(1).expect(format!("Endpoint {} doesn't contain game id", endpoint).to_string().as_str());
            let game_id = from_str::<i32>(game_id_str).unwrap(); // if game_id in request uri is not an integer, the request should crash anyway
            let maybe_player_name: Option<&str> = request.uri().path().segments().get(2);

            // If game id is not present or player is not present in game, don't do anything // Need to think about this, maybe add not found page
            // Error will be handled by controller
            if !games.contains_key(&game_id) {
            // if !games.contains_key(&game_id) || !games.get(&game_id).unwrap().players.lock().unwrap().contains(&player_name.to_owned()) {
                return;
            }

            // Check authorization token
            let headers = request.headers();
            let maybe_token_in_headers: Option<&str> = headers.get(AUTHORIZATION.as_str()).next();
            let maybe_token_in_cookies: Option<&rocket::http::Cookie<'_>> = request.cookies().get(AUTHORIZATION_HEADER_NAME);

            let token: String;
            if maybe_token_in_headers.is_some() {
                token = maybe_token_in_headers.unwrap().to_string();
            } else if maybe_token_in_cookies.is_some() {
                token = maybe_token_in_cookies.unwrap().value().to_string();
            } else { // If there is no token, route to 401
                request.set_uri(Origin::parse(UNAUTHORIZED_URI).unwrap());
                return;
            }

            // If token is invalid, route to 403
            let game_auth_secret: String = games.get(&game_id).unwrap().auth_secret.to_owned();
            if !authorize_token(token, game_id, maybe_player_name, game_auth_secret, should_authorize_player_name) {
                request.set_uri(Origin::parse(FORBIDDEN_URI).unwrap());
            }
        }
    }
}