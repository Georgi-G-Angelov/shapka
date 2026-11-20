# Shapka app

The Flutter client for Shapka, the hat game. It follows the design in
[`../design`](../design/README.md) and talks to the Rust server in this repo.

## Run it

```sh
cargo run                       # in the repo root: the server on :8000
cd app && flutter run           # debug builds use http://127.0.0.1:8000 (10.0.2.2 on the Android emulator)
flutter run --release           # release builds use the production server
flutter run --dart-define=SHAPKA_SERVER=https://other.server      # any other server
```

The production server is described in [`../DEPLOYMENT.md`](../DEPLOYMENT.md).
Plain http only works for local networking on iOS, and only in debug builds on
Android.

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

## Releasing (iOS)

App Store Connect app **Shapka**, bundle id `com.shapka.shapkaapp`, team
BrightEdge Digital Ltd (`ZQ3TCXTVPF`). iPhone only, portrait, iOS 15+.

**Actions → Release (iOS) → Run workflow** (`.github/workflows/release-ios.yml`)
builds a signed `.ipa` on a GitHub-hosted Mac and uploads it, like Sharp's
release workflow:

| Input | What it does |
| --- | --- |
| `destination` | `testflight` uploads the build. `app_store_review` also creates the App Store version from `pubspec.yaml`, attaches the build and submits it for review, released by hand after approval. |
| `upload` | Uncheck to only build and attach the `.ipa` to the run. |
| `beta_group` | Optional external TestFlight group to submit the build to. |
| `build_number` | Blank = commit count. Set it when re-running on a commit whose number was already uploaded. |
| `release_notes` | What's New (en-US). Required for `app_store_review`. |

The version comes from `pubspec.yaml` (`version: 1.0.0+1` → 1.0.0); bump it after
each App Store release. Release builds talk to the production server.

### One-time setup: repository secrets

The workflow signs with [codemagic-cli-tools](https://github.com/codemagic-ci-cd/cli-tools)
and the App Store Connect API, the same way as Sharp. Sharp is in the same team,
so **its four secrets work here unchanged**: copy them from wherever you keep
them (GitHub won't show secret values).

| Secret | Value |
| --- | --- |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (App Store Connect → Users and Access → Integrations → Team Keys) |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | The key's Key ID (App Manager or Admin role) |
| `APP_STORE_CONNECT_PRIVATE_KEY` | The full `AuthKey_<id>.p8`, including the BEGIN/END lines |
| `IOS_DISTRIBUTION_CERT_PRIVATE_KEY` | The RSA key Sharp's distribution certificate was issued for. Reusing it means no new certificate (a team can hold at most three). A new key (`ssh-keygen -t rsa -b 2048 -m PEM -f key -N ""`) also works and creates a certificate on the first run. |

### Uploading from a Mac instead

```sh
flutter build ipa --release --build-number=$(git rev-list --count HEAD)
# then Xcode → Window → Organizer → Distribute App, or Transporter with build/ios/ipa/*.ipa
```

## Releasing (Android)

Google Play app **Shapka**, package `com.shapka.shapkaapp` (the same id as iOS;
Play never lets it change), in the same Play developer account as Sharp.

**Actions → Release (Android) → Run workflow** (`.github/workflows/release-android.yml`)
builds a release app bundle signed with the upload key and uploads it, like
Sharp's Android release workflow:

| Input | What it does |
| --- | --- |
| `track` | `internal`, `alpha` (closed testing), `beta` (open testing) or `production`. |
| `status` | `completed` rolls the release out on the track. `draft` leaves it for you to roll out in Play Console; Play only accepts `draft` until the app's first release has been reviewed. |
| `upload` | Uncheck to only build and attach the `.aab` to the run. |
| `version_code` | Blank = above everything already on Play and never below the commit count (`scripts/play_version_code.py`). |
| `release_notes` | Release notes (en-US). Optional. |

The version name comes from `pubspec.yaml`, as on iOS. Play App Signing holds the
real app signing key; the workflow signs with the **upload key** only.

### First release

Play only accepts uploads through the API once a first bundle has been uploaded by
hand: run the workflow with `upload` unchecked, download the `.aab` from the run's
artifacts, and upload it in Play Console (Testing → Internal testing → Create new
release). After that, the workflow can publish every release.

### One-time setup: repository secrets

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -i android/app/upload-keystore.jks` (already set) |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` | Passwords from `android/key.properties` (already set) |
| `ANDROID_KEY_ALIAS` | `upload` (already set) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Sharp's Play service account key (`sharp-app@sharp-app-501714.iam.gserviceaccount.com`), the same value as Sharp's secret of that name (already set). The account has access to every app in the Play developer account. |

The upload keystore (`android/app/upload-keystore.jks`) and `android/key.properties`
are gitignored. Keep a copy of both in a password manager: without them, the upload
key has to be reset through Play Console. Upload key fingerprints:

```
SHA-1:   CB:68:78:E7:D2:02:09:D5:B3:50:29:38:FB:83:B0:17:00:21:01:A6
SHA-256: F8:56:C5:BC:60:B6:66:9B:D6:98:C3:8D:4A:D2:AF:7A:05:A9:5E:A0:12:6F:0C:8B:87:D2:11:DB:F4:91:97:B4
```

Without `android/key.properties`, release builds fall back to the debug key, so
`flutter run --release` still works on any machine.
