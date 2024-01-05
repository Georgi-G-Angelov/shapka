use std::path::{Path};
use rocket::fs::{NamedFile};

#[get("/home")]
pub async fn home() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/home.html")).await.ok()
}

#[get("/join")]
pub async fn join() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/join.html")).await.ok()
}

#[get("/create")]
pub async fn create() -> Option<NamedFile> {
    NamedFile::open(Path::new("static/create.html")).await.ok()
}