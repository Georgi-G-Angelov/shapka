use std::collections::HashSet;

use chashmap::CHashMap;
use rocket::{fairing::{Fairing, Info, Kind}, http::{hyper::header::AUTHORIZATION, uri::Origin}, serde::json::from_str, Data, Request};

use crate::Game;

use super::utils::{authorize_token, FORBIDDEN_URI, UNAUTHORIZED_URI};

pub(crate) struct Authenticator {
    endpoints_to_authenticate: HashSet<String>
}

impl Authenticator {
    pub fn new() -> Self {
        // Make sure uri's for 403 and 401 requests are fine
        let _forbidden = Origin::parse(FORBIDDEN_URI).unwrap();
        let _unauthorized = Origin::parse(UNAUTHORIZED_URI).unwrap();

        let mut endpoints_to_authenticate = HashSet::new();
        endpoints_to_authenticate.insert("add_word".to_owned());
        Self {
            endpoints_to_authenticate
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
        } else if self.endpoints_to_authenticate.contains(maybe_endpoint.unwrap()) {

            // All endpoints that need to be authenticated must be of the form /<endpoint>/<game_id>/<player_name>
            let endpoint = maybe_endpoint.unwrap();
            let game_id_str = request.uri().path().segments().get(1).expect(format!("Endpoint {} doesn't contain game id", endpoint).to_string().as_str());
            let game_id = from_str::<i32>(game_id_str).unwrap(); // if game_id in request uri is not an integer, the request should crash anyway
            let player_name = request.uri().path().segments().get(2).expect(format!("Endpoint {} doesn't contain player name", endpoint).to_string().as_str());

            // If game id is not present or player is not present in game, don't do anything
            // Error will be handled by controller
            if !games.contains_key(&game_id) || !games.get(&game_id).unwrap().players.lock().unwrap().contains(&player_name.to_owned()) {
                return;
            }

            // Check authentication token
            let headers = request.headers();

            // If there is no token, route to 401
            if !headers.contains(AUTHORIZATION) {
                request.set_uri(Origin::parse(UNAUTHORIZED_URI).unwrap());
                return;
            }

            // If token is invalid, route to 403
            let game_auth_secret: String = games.get(&game_id).unwrap().auth_secret.to_owned();
            let token: String = headers.get(AUTHORIZATION.as_str()).next().unwrap().to_string();
            println!("Token supplied: {}", token);
            if !authorize_token(token, game_id, player_name.to_owned(), game_auth_secret) {
                request.set_uri(Origin::parse(FORBIDDEN_URI).unwrap());
            }
        }
    }
}