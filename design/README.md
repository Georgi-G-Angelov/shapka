# Shapka — app design prototype

Interactive HTML/React prototype of the Shapka Flutter app (`project/Shapka.html`),
built the same way as `Scroll-App-Design`: an iOS/Android device frame, React via
Babel in the browser, a Tweaks panel and deep links for every state.

**Baseline: the web client and Rust server on `master` at `08ada8e`.**
The prototype is a design for a native client of the *existing* server. Game rules
are a line-by-line port of the server (`project/shapka-game.js`) and run under
`node --test`, so every screen shows a state the server can actually produce.
Other players are simulated locally; nothing here contacts a server.

## Run it

```sh
python3 design/tools/serve.py            # http://127.0.0.1:8840/Shapka.html (no cache)
node --test design/tools/*.test.cjs      # rules + scenario tests
```

Deep links: `Shapka.html?screen=<name>` with any of `home`, `create`, `join`,
`lobby`, `lobbyReady`, `lobbyOdd`, `lobbyPlayer`, `explainer`, `explainerLive`,
`timesUp`, `roundOver`, `guesser`, `spectator`, `bigGame` (5 teams), `customRounds`
(45s turns, Describe + Act it out), `results`, `resultsTie`.
Add `theme=dark|light|system`, `platform=android`, `phone=compact`,
`speed=3|10` (clock speed) or `connection=reconnecting`.

The whole game is playable: create a game, add words, wait for the simulated
friends, start, and play all three rounds. Join with code **4821**; other codes
show "game not found", and Ani or Bobi are taken names.

## Visual language

Taken from the web client and pushed further:

- **Purple** from the web gradient (`#9C27B0 → #7B1FA2`), as `--primary` /
  `--primary-deep`. Light and dark palettes live in `shapka-app.jsx` (`PALETTES`)
  and map to `lib/theme.dart`.
- **Metal Mania** stays as the wordmark only, bundled under
  `project/assets/fonts` with its OFL licence. UI text uses the platform font.
- **The hat** (`static/shapka-logo-big.png`) is the logo, the home hero, the
  "words left in the hat" icon and the round-over illustration.
- **The stage.** Home, the team reveal and every in-game screen sit on a
  full-bleed purple stage (`--stage`, `--stage-2`) with white type, readable at
  arm's length in a dim room. Setup screens (create, join, lobby, results) use
  the calm light/dark surfaces.
- **Team colours** (`TEAM_COLORS`, ten for up to 20 players) tag avatars, score
  chips and results. Before teams exist a player's colour comes from their name.
- The three time's-up alarms from `static/audio` are kept (ogg + m4a).

## Screens

| Screen | Replaces | Notes |
| --- | --- | --- |
| Home | `home.html` | **Create** / **Join**. "Game 4821 is still going" resume card replaces `checkActiveGameExists()`; `?` opens How to play. Moon toggles theme, like the web header. |
| Create | `create.html` | Name (remembered) and a 4–7 stepper instead of a free number field. A collapsed **Advanced** section (summary: "60s turns · all 3 rounds") lets the host pick the turn length (30/45/60/90/120s, default 60) and which rounds to play (any non-empty subset of Describe / One word / Act it out, default all; the last ticked round can't be unticked). |
| Join | `join.html` | Large numeric code field. Server errors land on the field they concern (`Game not found` → code, `Name already exists` → name). |
| Lobby | `host.html`, `await.html` | Game code with copy/share; *your* words as removable chips ("You're all set!" once you've added them all); every player's progress as dots (counts only, words stay secret); host can remove players. Host's Start explains exactly what's missing: a second player, an even count, or who still needs words. Players see "Waiting for Ani to start" and can leave. |
| Team reveal | — | New. Teams are random, so everyone sees "Your teammate is Pesho", all teams and who explains first. |
| Score strip | teams dropdown | Header chips per team; scrolls sideways with many teams and keeps the explaining team in view. |
| Explainer | `game.html` (turn player) | Ready: partner, 60s ring, Start (the round name is in the header). Live: compact ring (tap to pause; words blur while paused), a huge word card with a full-width **Got it**, "draw a second word" (the server's two-words-in-play rule, framed as a skip), and undo for the last guess. Time's up: alarm, the turn's words, **Pass to Ani**. |
| Guesser | `game.html` | "You're guessing! Listen to Bobi", big ring and a live count. Never shows the words. |
| Spectator | `game.html` | "Other team's turn", the same live ring and count, and when you play next. |
| Round over | `nextRound` button | The hat is empty, per-team score for the round, the next round's name. The explainer starts the next round and silently keeps their remaining time (≥ 1s), as the server does. |
| Results | `results.html` | Winner hero, standings with shared places on ties, gold/silver/bronze. Tap a team to see its words per round (collapsed by default). Play again. |
| Sheets | teams dropdown | Teams & scores, How to play, game menu, leave and remove confirmations. |

Every in-game screen is derived from `turnPhase(fetch_game_state)` plus the
player's role, so a phone that reconnects, was locked or rejoins shows the same
thing as everyone else (fixes the "missed events" bugs in the main README).

### Round rules (proposal)

The server only counts three rounds. The design names them with the classic hat
game rules: **Describe**, **One word**, **Act it out** (`ROUNDS` in
`shapka-game.js`). In game only the round name is shown; the one-line rules
appear in How to play and in Create → Advanced. Rounds always play in that order;
the header counts the chosen ones ("Round 2/2 · Act it out"). Change the copy there if your group plays differently.

## Flutter implementation notes

- **API.** Every action in `shapka-app.jsx` names its endpoint. Store
  `{gameId, name, authToken}` from `create_game` / `join_game` in secure
  storage and send `Authorization: <token>` on every call (the server also
  accepts the cookie, which the app doesn't need).
- **Encoding.** Names and words travel as URL path segments: percent-encode them.
  The client rejects `/`, spaces, digits and punctuation, and limits are UTF-8
  bytes (100), so 50 Cyrillic letters is the real cap.
- **Events.** `GET /gameevents/<id>` is SSE; each `data:` is a JSON string such as
  `"new_player:Ani"`. Reconnect with 1→64s backoff (as `general_utils.ts`),
  show the *Reconnecting…* pill, and refetch `/fetch_game_state` (in game) or
  `/fetch_players` + `/fetch_player_words` (lobby) after every reconnect and
  on app resume. Keep the 5s `/has_game_started` poll in the lobby.
- **Clock.** The explainer's phone owns the clock and reports it with
  `update_timer_state`; everyone else renders `timer_update:<ms>` events. Pause
  = `turn_active=false` with words still in play.
- **Device.** Keep the screen awake during a game (`wakelock_plus`), haptic on
  *Got it*, a heavy haptic + alarm at time's up, and play sounds through the
  media channel so a silent switch doesn't hide the alarm on Android.

## Game settings API

Create → Advanced maps to the server's settings route (the web client keeps using
the original route, which means 60s turns and all three rounds):

- `create_game/<name>/<word_limit>/<turn_seconds>/<rounds>`, e.g. `/60/123` or
  `/45/13`. Seconds must be 30/45/60/90/120; rounds are digits 1–3, played in
  ascending order, at least one.
- `GameState` gains `turn_length` (ms) and `rounds` (e.g. `[1, 3]`). `round`
  stays a 1-based position in `rounds`; `next_turn` and `next_round` reset the
  timer to `turn_length`, and the game ends after `rounds.len()` rounds.
  `words_guessed_per_team_per_round` is keyed 1..`rounds.len()`.

## Backend gaps found while porting the rules

Worth fixing before (or alongside) the app; the design avoids relying on them.

1. **Rate limits vs. one Wi-Fi.** Limits are per IP: 400 requests/min total and
   100/min per endpoint. A party shares one public IP, and the web client's
   500ms `update_timer_state` alone is 120/min. The app should report the clock
   once a second, and the limits probably need raising or keying by token.
2. `join_game` accepts players after the game has started (they're in no team),
   and `leave_game` / `kick_player` mid-game leave the rotation pointing at
   missing players. The app only offers leave/remove in the lobby.
3. `next_turn`, `next_round` and `update_timer_state` only check the game, not
   that the caller is the turn player.
4. `guess_word` doesn't set `is_round_active = false` when the hat empties; it
   relies on the client reporting it. The design derives "round over" from the
   hat being empty as well.
5. `new_word:<name>/<word>` broadcasts every word to every phone. The app
   shows only counts, but the words are still on the wire.
6. `fetch_player_words` panics (`unwrap`) for a name that isn't in the game.
7. Web client: `INITIAL_TIMER` is 5000 while the server starts at 60000.

## Files

- `project/Shapka.html` — shell, light palette, keyframes, script order.
- `project/shapka-game.js` — rules port (plain JS, also used by the tests).
- `project/shapka-sample.js` — sample players/words and deep-link scenarios.
- `project/shapka-components.jsx` — buttons, fields, avatars, timer ring, sheets, toast.
- `project/shapka-lobby.jsx` — Home, Create, Join, Lobby, How to play.
- `project/shapka-play.jsx` — game screen for every role and phase, sheets, Results.
- `project/shapka-app.jsx` — navigation, themes, simulation, tweaks.
- `project/ios-frame.jsx`, `project/tweaks-panel.jsx` — copied unchanged from Scroll-App-Design.
- `tools/serve.py` — no-cache preview server; `tools/*.test.cjs` — `node --test`.
