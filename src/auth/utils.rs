use rocket::response::status;

pub const FORBIDDEN_URI: &str = "/forbidden";
pub const UNAUTHORIZED_URI: &str = "/unauthorized";

pub fn generate_token(game_id: i32, player_name: String, game_auth_secret: String) -> String {
    return "this is a token".to_owned();
}

pub fn authorize_token(token: String, game_id: i32, player_name: String, game_auth_secret: String) -> bool {
    return true;
}

#[get("/forbidden")]
pub async fn forbidden() -> status::Forbidden<&'static str>{
    status::Forbidden("You do not have access")
}

#[get("/unauthorized")]
pub async fn unauthorized() -> status::Unauthorized<&'static str>{
    status::Unauthorized("Unauthorized request. Please provide autherization token")
}