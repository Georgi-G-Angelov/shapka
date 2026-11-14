# Shapka app

The Flutter client for Shapka, the hat game. It follows the design in
[`../design`](../design/README.md) and talks to the Rust server in this repo.

## Run it

```sh
cargo run                       # in the repo root: the server on :8000
cd app && flutter run           # debug builds use http://127.0.0.1:8000 (10.0.2.2 on the Android emulator)
flutter run --dart-define=SHAPKA_SERVER=https://shapka-server.agreeablebeach-1eae2480.polandcentral.azurecontainerapps.io   # production
```

Release builds need `SHAPKA_SERVER` pointing at an https server (iOS only
allows plain http for local networking; Android only in debug builds). The
production server is described in [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

## Tests

```sh
flutter analyze
flutter test                                                       # rules, API, events, screens (offline)
SHAPKA_TEST_SERVER=http://127.0.0.1:8000 flutter test test/server_flow_test.dart
flutter test integration_test/app_flow_test.dart -d <simulator>    # the real UI, full game, server on :8000
```

`server_flow_test` plays a whole four-player game through four controllers
against a running server: kicking, words, undo, pause, time up, a carried-over
turn into round 2 and results. `app_flow_test` drives the actual app on a
simulator while other players act over the API, and logs a `SHOT` line at each
screen for screenshots. CI (`.github/workflows/app.yml`) runs analyze, the unit
and widget tests, and `server_flow_test` against a freshly built server.

## How it works

| Piece | File | Notes |
| --- | --- | --- |
| Rules | `lib/game/rules.dart` | Mirrors the server's constants and `GameState` (incl. `turn_length`, `rounds`). Every screen derives from `GameState.phase` and `roleOf`, so a phone that reconnects lands where everyone else is. Validation matches the web client and the server's UTF-8 byte limits. |
| API | `lib/api/shapka_api.dart` | One method per endpoint. Values are path segments, percent-encoded. The game token from create/join goes in `Authorization`. Plain-text server errors become `ApiException`s with friendly copy. |
| Events | `lib/api/events.dart` | SSE client for `/gameevents/<id>` with 1→64s backoff (like `general_utils.ts`). |
| Controller | `lib/game/game_controller.dart` | One joined game: lobby data, state, events, polling, and the clock when this phone explains. Refetches after every reconnect, app resume and missed `start_game`. |
| Session | `lib/session/session_store.dart` | `{gameId, name, token}` in secure storage for rejoining; the last name in preferences. |
| Screens | `lib/screens/` | Home, Create (with Advanced), Join, Lobby, team reveal, game (explainer / guesser / other team, round over), results, sheets. |

### Behaviour worth knowing

- **The explainer's phone owns the clock.** It counts down locally and reports
  to `update_timer_state` once a second; other phones interpolate between
  reports. The web client reported every 500ms, but the server rate-limits per
  IP (400/min) and a party shares one network. Reports go out strictly in
  order so a late "running" report can't undo a pause or time-up.
- If the explainer's reports stop for 2.5s, watchers refetch once (paused or
  dropped). A turn left running when the explainer's app closed is paused when
  they come back.
- Time's up rings one of the original alarms (looped, max 10s, ignores the
  silent switch) with a heavy haptic. The screen stays awake during a game.
- "Back to home" keeps the game: Home shows a "still going" card to rejoin.
  Leaving (lobby only) and being removed clear the saved session.
- Undo is offered for the latest guess of the current turn only.

## Assets

`assets/images/hat.png` is the web client's logo, `assets/sounds/` the three
alarms (m4a plays on iOS and Android), and `assets/fonts/MetalMania-*` the
wordmark font with its OFL licence. Launcher icons are generated from
`assets/launcher_icon/` with `dart run flutter_launcher_icons`.
