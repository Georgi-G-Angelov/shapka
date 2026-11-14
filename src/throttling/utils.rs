use std::collections::HashMap;
use std::net::IpAddr;

use rocket::{get, http::Status, response::status::Custom};

use crate::extentions::arc_string::ArcString;

pub const TOO_MANY_REQUESTS_URI: &str = "/too_many_requests";
pub const TRUST_FORWARDED_FOR_ENV: &str = "SHAPKA_TRUST_FORWARDED_FOR";

// The address requests are counted against. With a trusted proxy in front, that is the last
// X-Forwarded-For entry: the proxy appends the address it saw, while earlier entries come from
// the client and can be anything.
pub fn client_ip(trust_forwarded_for: bool, forwarded_for: Option<&str>, socket_ip: Option<IpAddr>) -> String {
    if trust_forwarded_for {
        let appended = forwarded_for
            .and_then(|header| header.rsplit(',').next())
            .and_then(|entry| entry.trim().parse::<IpAddr>().ok());
        if let Some(ip) = appended {
            return ip.to_string();
        }
    }
    socket_ip.map(|ip| ip.to_string()).unwrap_or_else(|| "unknown".to_string())
}

#[get("/too_many_requests")]
pub async fn too_many_requests() -> Custom<&'static str>{
    Custom(Status::TooManyRequests, "Too many requests, please slow down.")
}

pub struct PerMinuteRequestsCounter {
    pub minute: u64,
    pub total_requests: u64,
    pub per_endpoint_requests: HashMap<ArcString, u64>,
    pub throttled_logged: bool // so a throttled client is logged once per minute, not per request
}

impl PerMinuteRequestsCounter {
    pub fn new(current_minute: u64) -> Self {
        Self {
            minute: current_minute,
            total_requests: 0,
            per_endpoint_requests: HashMap::new(),
            throttled_logged: false
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
        self.throttled_logged = false;
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> Option<IpAddr> {
        Some(s.parse().unwrap())
    }

    #[test]
    fn the_socket_address_is_used_unless_a_proxy_is_trusted() {
        assert_eq!(client_ip(false, Some("1.2.3.4"), ip("10.0.0.1")), "10.0.0.1");
        assert_eq!(client_ip(false, None, None), "unknown");
    }

    #[test]
    fn behind_a_trusted_proxy_the_address_it_appended_counts() {
        assert_eq!(client_ip(true, Some("203.0.113.7"), ip("10.0.0.1")), "203.0.113.7");
        // A client-supplied entry can't change who is counted
        assert_eq!(client_ip(true, Some("6.6.6.6, 203.0.113.7"), ip("10.0.0.1")), "203.0.113.7");
        assert_eq!(client_ip(true, Some("2001:db8::1"), ip("10.0.0.1")), "2001:db8::1");
        // Missing or garbled header: fall back to the socket
        assert_eq!(client_ip(true, None, ip("10.0.0.1")), "10.0.0.1");
        assert_eq!(client_ip(true, Some("not-an-ip"), ip("10.0.0.1")), "10.0.0.1");
    }
}
