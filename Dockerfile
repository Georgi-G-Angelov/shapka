# syntax=docker/dockerfile:1.6
#
# The Shapka server and its web client in one image.
#
#   1. `web`      — compiles static/ts into static/js/main.js (TypeScript 5: tsconfig uses outFile).
#   2. `planner`  — cargo-chef recipe of the dependency graph.
#   3. `builder`  — cooks dependencies (cached), then builds the server.
#   4. `runtime`  — slim Debian with the binary and static/ at /app.
#
# The server serves static/ from the path it was compiled in (relative!("static")) and reads
# static/html relative to the working directory, so both are /app in every stage.

ARG RUST_VERSION=1.95.0

FROM node:22-slim AS web
WORKDIR /app
RUN npm install -g typescript@5.8.3
COPY tsconfig.json ./
COPY static/ts ./static/ts
RUN tsc

FROM lukemathwalker/cargo-chef:latest-rust-${RUST_VERSION} AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin shapka

FROM debian:trixie-slim AS runtime
RUN groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=builder /app/target/release/shapka /usr/local/bin/shapka
COPY static ./static
COPY --from=web /app/static/js ./static/js
USER app
# Behind Azure Container Apps ingress the client address is the last X-Forwarded-For entry.
ENV ROCKET_ADDRESS=0.0.0.0 \
    ROCKET_PORT=8000 \
    ROCKET_PROFILE=release \
    SHAPKA_TRUST_FORWARDED_FOR=true \
    RUST_BACKTRACE=1
EXPOSE 8000
CMD ["shapka"]
