use std::sync::Arc;

use chashmap::CHashMap;
use rocket::{fairing::{Fairing, Info, Kind}, http::uri::Origin, Data, Request, Route};

use crate::{extentions::arc_string::ArcString, throttling::utils::{PerMinuteRequestsCounter, TOO_MANY_REQUESTS_URI}};

// per minute limits
const TOTAL_REQUESTS_LIMIT: u64 = 400;
const PER_ENDPOINT_DEFAULT_REQUESTS_LIMIT: u64 = 100;


pub(crate) struct RateLimiter {
    per_ip_requests: CHashMap<String, PerMinuteRequestsCounter>,
    endpoints: CHashMap<String, ArcString>, // Contains all endpoint names mapped to themselves - a memory optimisation
    
    // Limits per minute
    total_requests_limit: u64, // This can be set to a specific value if needed
    per_endpoint_default_requests_limit: u64, // This can be set to a specific value if needed
    per_endpoint_override_limits: CHashMap<ArcString, u64> // This can be used to override the default limit for specific endpoints
}

impl RateLimiter {
    pub fn new(routes: Vec<Route>) -> Self {
        // Initialize the endpoints map with the base URIs of the routes
        let endpoints: CHashMap<String, ArcString> = CHashMap::new();
        for route in routes {
            let route_uri = route.uri.unmounted_origin.path().segments().get(0)
                .unwrap_or(&"")
                .to_string();
            endpoints.insert(route_uri.clone(), ArcString(Arc::new(route_uri)));
        }

        // Set override limits for specific endpoints if needed
        let per_endpoint_override_limits: CHashMap<ArcString, u64> = CHashMap::new();
        per_endpoint_override_limits.insert(ArcString(Arc::new("create_game".to_string())), 5);

        Self {
            per_ip_requests: CHashMap::new(),
            endpoints: endpoints,
            total_requests_limit: TOTAL_REQUESTS_LIMIT,
            per_endpoint_default_requests_limit: PER_ENDPOINT_DEFAULT_REQUESTS_LIMIT,
            per_endpoint_override_limits: per_endpoint_override_limits
        }
    }
}

#[rocket::async_trait]
impl Fairing for RateLimiter {
    fn info(&self) -> Info {
        Info {
            name: "RateLimiter fairing",
            kind: Kind::Request
        }
    }

    async fn on_request(&self, request: &mut Request<'_>, _: &mut Data<'_>) {
        let sender_ip = request.remote().unwrap().ip().to_string();
        // println!("Request from IP: {}", sender_ip);
        let current_minute = (chrono::Utc::now().timestamp_millis() / 60000) as u64;

        // println!("endpoint: {}", request.uri().path().segments().get(0).unwrap_or(&""));
        // for (key, value) in self.endpoints.clone().into_iter(){
        //     println!("{}: {}", key, value);
        // }

        let endpoint_from_request = request.uri().path().segments().get(0).unwrap_or(&"");

        // Get an ArcString from the saved endpoints for memory efficiency
        let endpoint_for_throttling: ArcString = match self.endpoints.get(endpoint_from_request) {
            Some(endpoint) => endpoint.clone(),
            None => ArcString(Arc::new("".to_string())),
        };

        // println!("endpoint for throttling: {}", endpoint_for_throttling);

        if self.per_ip_requests.contains_key(&sender_ip) {
            let mut counter = self.per_ip_requests.get_mut(&sender_ip).unwrap();
            
            // println!("Current minute: {}, Counter minute: {}", current_minute, counter.minute);

            // If it's a new minute, reset and don't throttle
            if counter.minute != current_minute {
                counter.reset(current_minute);
                return;
            } else { // If it's the same minute, check if sender should be throttled
                let current_endpoint_requests = *counter.per_endpoint_requests.get(&endpoint_for_throttling).unwrap_or(&0);
                let current_endpoint_limit = match self.per_endpoint_override_limits.get(&endpoint_for_throttling) {
                    Some(limit) => *limit,
                    None => self.per_endpoint_default_requests_limit,
                };

                // println!("Current endpoint requests: {}, Current endpoint limit: {}", current_endpoint_requests, current_endpoint_limit);

                if counter.total_requests >= self.total_requests_limit
                || current_endpoint_requests >= current_endpoint_limit {
                    // If the limit is reached, redirect to the too many requests endpoint
                    request.set_uri(Origin::parse(TOO_MANY_REQUESTS_URI).unwrap());
                    return;
                }

                counter.increment(endpoint_for_throttling);
            }
        } else {
            let mut counter = PerMinuteRequestsCounter::new(current_minute);
            counter.increment(endpoint_for_throttling);
            self.per_ip_requests.insert(sender_ip, counter);
        }
    }
}