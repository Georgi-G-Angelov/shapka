use std::collections::HashMap;

use rocket::{get, http::Status, response::status::Custom};

use crate::extentions::arc_string::ArcString;

pub const TOO_MANY_REQUESTS_URI: &str = "/too_many_requests";

#[get("/too_many_requests")]
pub async fn too_many_requests() -> Custom<&'static str>{
    Custom(Status::TooManyRequests, "Too many requests, please slow down.")
}

pub struct PerMinuteRequestsCounter {
    pub minute: u64,
    pub total_requests: u64,
    pub per_endpoint_requests: HashMap<ArcString, u64>
}

impl PerMinuteRequestsCounter {
    pub fn new(current_minute: u64) -> Self {
        Self {
            minute: current_minute,
            total_requests: 0,
            per_endpoint_requests: HashMap::new()
        }
    }

    // Increment the request count for a specific endpoint and the total count
    // If the endpoint is not present, it will be added with a count of 1
    pub fn increment(&mut self, endpoint: ArcString) {
        self.total_requests += 1;
        *self.per_endpoint_requests.entry(endpoint).or_insert(0) += 1;
    }

    // Reset the counter for a new minute
    // This will clear the total requests and per endpoint requests
    pub fn reset(&mut self, current_minute: u64) {
        self.minute = current_minute;
        self.total_requests = 0;
        self.per_endpoint_requests.clear();
    }
}