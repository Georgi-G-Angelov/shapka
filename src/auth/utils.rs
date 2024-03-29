use rocket::response::status;
use hmac::{Hmac, Mac};
use jwt::{SignWithKey, VerifyWithKey};
use sha2::Sha256;
use std::collections::BTreeMap;

pub const AUTHORIZATION_HEADER_NAME: &str = "Authorization";
pub const FORBIDDEN_URI: &str = "/forbidden";
pub const UNAUTHORIZED_URI: &str = "/unauthorized";
const GAME_ID_KEY: &str = "gameId";
const PLAYER_NAME_KEY: &str = "playerName";

pub fn generate_token(game_id: i32, player_name: String, game_auth_secret: String) -> String {
    let mut claims = BTreeMap::new();
    claims.insert(GAME_ID_KEY, game_id.to_string());
    claims.insert(PLAYER_NAME_KEY, player_name);
    let key: Hmac<Sha256> = Hmac::new_from_slice(game_auth_secret.as_bytes())
        .expect(format!("Could not create key for secret {}", game_auth_secret).as_str());
    let token = claims.sign_with_key(&key)
        .expect(format!("Could not create token from key from secret {}", game_auth_secret).as_str());
    return token;
}

pub fn authorize_token(token: String, game_id: i32, maybe_player_name: Option<&str>, game_auth_secret: String, authorize_player_name: bool) -> bool {
    let key: Hmac<Sha256> = Hmac::new_from_slice(game_auth_secret.as_bytes())
        .expect(format!("Could not create key for secret {}", game_auth_secret).as_str());

    let maybe_claims: Result<BTreeMap<String, String>, jwt::Error> = token.as_str().verify_with_key(&key);
    if maybe_claims.is_err() {
        println!("Could not verify token {} for secret {}", token, game_auth_secret);
        return false;
    }

    let claims: BTreeMap<String, String> = maybe_claims.unwrap();

    if maybe_player_name.is_some() && authorize_player_name {
        return claims[GAME_ID_KEY] == game_id.to_string() && claims[PLAYER_NAME_KEY] == maybe_player_name.unwrap();
    } else if !authorize_player_name {
        return claims[GAME_ID_KEY] == game_id.to_string();
    }

    return false;
}

#[get("/forbidden")]
pub async fn forbidden() -> status::Forbidden<&'static str>{
    status::Forbidden("You do not have access")
}

#[get("/unauthorized")]
pub async fn unauthorized() -> status::Unauthorized<&'static str>{
    status::Unauthorized("Unauthorized request. Please provide autherization token")
}