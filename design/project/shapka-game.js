// Shapka — local game rules for the design prototype.
// A line-by-line port of the Rust server (src/models/game.rs, src/controllers/*)
// so the prototype behaves like a real game. `game.state` has exactly the shape
// of GET /fetch_game_state (serde snake_case); the lobby fields mirror Game.
// Error strings are the server's own response bodies. Nothing here touches the
// network; the Flutter app will call the endpoints named in each comment.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShapkaGame = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // src/constants.rs
  const LIMITS = Object.freeze({
    timerStartMs: 60000,
    maxWordsInPlay: 2,
    minWordsPerPlayer: 4,
    maxWordsPerPlayer: 7,
    defaultWordsPerPlayer: 5,
    maxWordLength: 100,
    maxNameLength: 100,
    maxPlayers: 20,
    rounds: 3,
    maxGameId: 100000,
    // Host settings (Create → Advanced). Server today: fixed 60s and all three rounds.
    turnSeconds: [30, 45, 60, 90, 120],
    defaultTurnSeconds: 60,
    // next_round keeps the explainer's turn only with at least this much time left.
    keepTurnMinMs: 1000,
  });

  // Design copy: the classic hat-game round rules. The server only counts
  // rounds; these labels are a proposal for the app (see design/README.md).
  // A game plays any non-empty subset of them, always in this order.
  const ROUNDS = Object.freeze([
    { round: 1, title: "Describe", rule: "Say anything except the word itself." },
    { round: 2, title: "One word", rule: "Give a single-word clue." },
    { round: 3, title: "Act it out", rule: "No words at all, just gestures." },
  ]);

  const ERRORS = Object.freeze({
    gameNotFound: "Game not found",
    gameFull: `Game is full. Max players per game is ${LIMITS.maxPlayers}`,
    nameTaken: "Name already exists",
    nameTooLong: `Player name is too long. Max length is ${LIMITS.maxNameLength}`,
    wordTooLong: `Word is too long. Max length is ${LIMITS.maxWordLength}`,
    limitLow: `Word count per player is too low. Lower limit is ${LIMITS.minWordsPerPlayer}`,
    limitHigh: `Word count per player is too high. Upper limit is ${LIMITS.maxWordsPerPlayer}`,
    notInGame: "Player not in game",
    onlyHostKicks: "Only the host can kick people",
    wordLimitReached: "You can't add more words",
    wordNotFound: "Word not found",
    oddPlayers: "Game cannot start with an odd number of players",
    missingWords: "Players still need to add words",
    notTurnPlayer: "You are not the turn player",
    enoughInPlay: "You already have enough words in play",
    noWordsLeft: "No words left",
    wordNotInPlay: "This word is not in play",
    nothingToUndo: "No words guessed this round",
    gameFinished: "Game is finished",
    badTurnLength: "Choose a turn length",
    noRounds: "Pick at least one round",
  });

  // Deterministic RNG (mulberry32) so previews and tests are reproducible.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Rust's str::len() counts UTF-8 bytes, so Cyrillic names hit the limit sooner.
  const byteLength = text => new TextEncoder().encode(text).length;

  const ok = value => ({ ok: true, ...value });
  const fail = error => ({ ok: false, error });

  // ── Client-side validation (static/ts/utils/string_utils.ts + server limits) ──
  // "/" is rejected too: names and words travel as URL path segments.
  const PUNCTUATION = ";:.,?!-'\"(){}/";

  function validateName(name) {
    const value = String(name ?? "").trim();
    if (!value) return fail("Enter your name");
    if (value.includes("/")) return fail("Names can't contain /");
    if (byteLength(value) > LIMITS.maxNameLength) return fail(ERRORS.nameTooLong);
    return ok({ value });
  }

  function validateWord(word, existing = []) {
    const value = String(word ?? "").trim();
    if (!value) return fail("Type a word first");
    if ([...value].some(ch => " \t\n".includes(ch) || PUNCTUATION.includes(ch))) {
      return fail("One word only, without spaces or punctuation");
    }
    if (/[0-9]/.test(value)) return fail("Words can't contain digits");
    if (byteLength(value) > LIMITS.maxWordLength) return fail(ERRORS.wordTooLong);
    if (existing.some(w => w.toLowerCase() === value.toLowerCase())) {
      return fail(`You already added "${value}"`);
    }
    return ok({ value });
  }

  function validateWordLimit(limit) {
    if (!Number.isInteger(limit)) return fail("Choose how many words each player adds");
    if (limit < LIMITS.minWordsPerPlayer) return fail(ERRORS.limitLow);
    if (limit > LIMITS.maxWordsPerPlayer) return fail(ERRORS.limitHigh);
    return ok({ value: limit });
  }

  function validateSettings({ turnSeconds = LIMITS.defaultTurnSeconds, rounds = [1, 2, 3] } = {}) {
    if (!LIMITS.turnSeconds.includes(turnSeconds)) return fail(ERRORS.badTurnLength);
    const kinds = [...new Set(rounds)].sort((a, b) => a - b);
    if (!kinds.length || kinds.some(k => !ROUNDS[k - 1])) return fail(ERRORS.noRounds);
    return ok({ value: { turnMs: turnSeconds * 1000, rounds: kinds } });
  }

  function validateGameCode(code) {
    const value = String(code ?? "").trim();
    if (!/^\d{1,5}$/.test(value)) return fail("Game codes are up to 5 digits");
    return ok({ value: Number(value) });
  }

  // ── Lobby — game_init_controller.rs, words_controller.rs ─────────────────────

  // models/game.rs init_game_state, including the host settings:
  // turn_length (ms) and rounds (the chosen round kinds, e.g. [1, 3]).
  // `round` stays a 1-based position in `rounds`.
  function initState(host, turnMs = LIMITS.timerStartMs, rounds = [1, 2, 3]) {
    const perRound = {};
    for (let r = 1; r <= rounds.length; r++) perRound[r] = {};
    return {
      timer: turnMs,
      turn_length: turnMs,
      rounds: [...rounds],
      turn_player: host,
      turn_player_index: 0,
      words_guessed_per_team_per_round: perRound,
      words_per_player: { [host]: [] },
      teams: [],
      teammates: {},
      team_member_to_team_index: {},
      player_rotation: [],
      words_guessed: [],
      words_in_play: [],
      words_to_guess: [],
      round: 1,
      is_turn_active: false,
      is_round_active: true,
      is_game_finished: false,
      has_game_started: false,
    };
  }

  // GET /create_game/<name>/<word_limit>/<turn_seconds>/<rounds>, e.g. …/60/123
  // (GET /create_game/<name>/<word_limit> keeps the defaults: 60s, all rounds)
  function createGame({ id, host, wordLimit = LIMITS.defaultWordsPerPlayer, turnSeconds, rounds }) {
    const limit = validateWordLimit(wordLimit);
    if (!limit.ok) return limit;
    if (byteLength(host) > LIMITS.maxNameLength) return fail(ERRORS.nameTooLong);
    const settings = validateSettings({ turnSeconds, rounds });
    if (!settings.ok) return settings;
    const { turnMs, rounds: kinds } = settings.value;
    return ok({
      game: { id, host, wordLimit, players: [host], words: [], state: initState(host, turnMs, kinds) },
    });
  }

  // The round kind (Describe / One word / Act it out) at a 1-based position.
  const roundInfo = (state, round = state.round) => ROUNDS[state.rounds[round - 1] - 1];
  const roundCount = state => state.rounds.length;

  // GET /join_game/<game_id>/<name>
  function joinGame(game, name) {
    if (!game) return fail(ERRORS.gameNotFound);
    if (byteLength(name) > LIMITS.maxNameLength) return fail(ERRORS.nameTooLong);
    if (game.players.length >= LIMITS.maxPlayers) return fail(ERRORS.gameFull);
    if (game.players.includes(name)) return fail(ERRORS.nameTaken);
    game.players.push(name);
    game.state.words_per_player[name] = [];
    return ok({ event: `new_player:${name}` });
  }

  function removePlayer(game, name) {
    game.players.splice(game.players.indexOf(name), 1);
    for (const word of game.state.words_per_player[name] || []) {
      const i = game.words.indexOf(word);
      if (i >= 0) game.words.splice(i, 1);
    }
    delete game.state.words_per_player[name];
  }

  // GET /leave_game/<game_id>/<name>
  function leaveGame(game, name) {
    if (!game.players.includes(name)) return fail(ERRORS.notInGame);
    removePlayer(game, name);
    return ok({ event: `player_left:${name}` });
  }

  // GET /kick_player/<game_id>/<name>/<player_to_kick>
  function kickPlayer(game, by, target) {
    if (by !== game.host) return fail(ERRORS.onlyHostKicks);
    if (!game.players.includes(target)) return fail(ERRORS.notInGame);
    removePlayer(game, target);
    return ok({ event: `player_kicked:${target}` });
  }

  // GET /add_word/<game_id>/<name>/<word>
  function addWord(game, name, word) {
    if (byteLength(word) > LIMITS.maxWordLength) return fail(ERRORS.wordTooLong);
    if (!game.players.includes(name)) return fail(ERRORS.notInGame);
    const mine = game.state.words_per_player[name];
    if (mine.length >= game.wordLimit) return fail(ERRORS.wordLimitReached);
    game.words.push(word);
    mine.push(word);
    return ok({ event: `new_word:${name}/${word}`, wordAdded: word, wordLimit: game.wordLimit });
  }

  // GET /delete_word/<game_id>/<name>/<word>
  function deleteWord(game, name, word) {
    const mine = game.state.words_per_player[name];
    if (!mine) return fail("Player doesn't exist");
    if (!mine.length) return fail("Player has no words");
    const i = mine.indexOf(word);
    if (i < 0) return fail(ERRORS.wordNotFound);
    mine.splice(i, 1);
    game.words.splice(game.words.indexOf(word), 1);
    return ok({ event: `word_removed:${name}/${word}`, wordRemoved: word });
  }

  // What the lobby shows: derived from new_player / new_word / word_removed events.
  // The app shows counts only, never other players' words.
  function lobbyStatus(game) {
    const progress = game.players.map(name => {
      const have = (game.state.words_per_player[name] || []).length;
      return { name, have, need: game.wordLimit, done: have >= game.wordLimit, host: name === game.host };
    });
    const waitingFor = progress.filter(p => !p.done).map(p => p.name);
    const count = game.players.length;
    let blocker = null;
    if (count < 2) blocker = { kind: "alone", message: "Invite at least one more player" };
    else if (count % 2 !== 0) blocker = { kind: "odd", message: `Teams are pairs: you need an even number of players (${count} joined)` };
    else if (waitingFor.length) blocker = { kind: "words", message: `Waiting for ${listNames(waitingFor)} to add words` };
    return {
      progress, waitingFor, count, blocker, canStart: !blocker,
      totalWords: game.words.length, targetWords: count * game.wordLimit,
    };
  }

  function listNames(names) {
    if (names.length <= 1) return names.join("");
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
  }

  // ── Turns — turns_controller.rs ─────────────────────────────────────────────

  // GET /start_game/<game_id>  (+ models/game.rs init_teams)
  function startGame(game, random) {
    if (game.players.length % 2 !== 0) return fail(ERRORS.oddPlayers);
    if (game.words.length < game.players.length * game.wordLimit) return fail(ERRORS.missingWords);
    const s = game.state;
    s.has_game_started = true;
    shuffle(game.players, random);
    const firsts = [];
    const seconds = [];
    game.players.forEach((player, i) => {
      if (i % 2 === 0) {
        s.teams.push([player]);
        firsts.push(player);
      } else {
        const partner = game.players[i - 1];
        const team = s.teams.length - 1;
        s.teams[team].push(player);
        s.teammates[player] = partner;
        s.teammates[partner] = player;
        s.team_member_to_team_index[player] = team;
        s.team_member_to_team_index[partner] = team;
        seconds.push(player);
      }
    });
    // Every team's first player explains once before any second player does.
    s.player_rotation = [...firsts, ...seconds];
    s.turn_player = s.player_rotation[0];
    s.turn_player_index = 0;
    shuffle(game.words, random);
    s.words_to_guess.push(...game.words.splice(0));
    return ok({ event: "start_game" });
  }

  const teamOf = (game, name) => game.state.team_member_to_team_index[name];
  const teammateOf = (game, name) => game.state.teammates[name];

  function roleOf(game, name) {
    const s = game.state;
    if (s.turn_player === name) return "explainer";
    if (s.teammates[s.turn_player] === name) return "guesser";
    return "spectator";
  }

  function upNext(game) {
    const s = game.state;
    if (!s.player_rotation.length) return null;
    const explainer = s.player_rotation[(s.turn_player_index + 1) % s.player_rotation.length];
    return { explainer, guesser: s.teammates[explainer] };
  }

  // The whole game screen is derived from GET /fetch_game_state, so a phone that
  // reconnects, rejoins or missed an event lands on the same view as everyone else.
  // A paused turn always holds a word: a live turn auto-draws one whenever none is in play.
  function turnPhase(state) {
    if (!state.has_game_started) return "lobby";
    if (state.is_game_finished) return "gameOver";
    if (!state.is_round_active) return "roundOver";
    if (state.timer <= 0) return "timesUp";
    if (state.is_turn_active) return "live";
    if (state.timer < state.turn_length && state.words_in_play.length) return "paused";
    return "ready";
  }

  const wordsLeft = game => game.state.words_in_play.length + game.state.words_to_guess.length;
  const totalWords = game => wordsLeft(game) + game.state.words_guessed.length;

  // GET /update_timer_state/<game_id>/<millis>/<turn_active>/<round_active>/<round>
  // The explainer's device owns the clock and broadcasts timer_update:<millis>.
  function updateTimer(game, millis, { turnActive, roundActive } = {}) {
    const s = game.state;
    s.timer = Math.max(0, Math.round(millis));
    if (turnActive !== undefined) s.is_turn_active = turnActive;
    if (roundActive !== undefined) s.is_round_active = roundActive;
    return ok({ event: `timer_update:${s.timer}` });
  }

  // GET /fetch_word/<game_id>/<name>
  function fetchWord(game, name) {
    const s = game.state;
    if (s.turn_player !== name) return fail(ERRORS.notTurnPlayer);
    if (s.words_in_play.length >= LIMITS.maxWordsInPlay) return fail(ERRORS.enoughInPlay);
    if (!s.words_to_guess.length) return fail(ERRORS.noWordsLeft);
    const word = s.words_to_guess.pop();
    s.words_in_play.push(word);
    return ok({ word });
  }

  // GET /guess_word/<game_id>/<name>/<word>
  function guessWord(game, name, word) {
    const s = game.state;
    if (s.turn_player !== name) return fail(ERRORS.notTurnPlayer);
    const i = s.words_in_play.indexOf(word);
    if (i < 0) return fail(ERRORS.wordNotInPlay);
    s.words_in_play.splice(i, 1);
    const team = teamOf(game, name);
    const perTeam = s.words_guessed_per_team_per_round[s.round];
    (perTeam[team] = perTeam[team] || []).push(word);
    s.words_guessed.push(word);
    const roundOver = !s.words_to_guess.length && !s.words_in_play.length;
    if (roundOver) {
      // The server only flags game end; the explainer's client then reports
      // round_active=false through update_timer_state.
      if (s.round === roundCount(s)) s.is_game_finished = true;
      s.is_round_active = false;
      s.is_turn_active = false;
    }
    return ok({
      word, roundOver, gameOver: s.is_game_finished,
      events: [`word_guessed:${word}`, ...(roundOver ? ["out_of_words"] : [])],
    });
  }

  // GET /undo_guess_word/<game_id>/<name>
  // The server lets the explainer undo any of their team's guesses this round;
  // the app only offers it for the latest guess of the current turn.
  function undoGuess(game, name) {
    const s = game.state;
    if (s.turn_player !== name) return fail(ERRORS.notTurnPlayer);
    const team = teamOf(game, name);
    const mine = s.words_guessed_per_team_per_round[s.round][team];
    if (!mine || !mine.length) return fail(ERRORS.nothingToUndo);
    const word = mine.pop();
    s.words_guessed.pop();
    if (s.words_in_play.length >= LIMITS.maxWordsInPlay) s.words_to_guess.push(s.words_in_play.pop());
    s.words_in_play.push(word);
    return ok({ word, event: `undo_guess:${word}` });
  }

  function rotate(s) {
    s.turn_player_index = (s.turn_player_index + 1) % s.player_rotation.length;
    s.turn_player = s.player_rotation[s.turn_player_index];
  }

  // GET /next_turn/<game_id>
  function nextTurn(game, random) {
    const s = game.state;
    rotate(s);
    s.timer = s.turn_length;
    s.is_turn_active = false;
    s.words_to_guess.push(...s.words_in_play.splice(0));
    shuffle(s.words_to_guess, random);
    return ok({ event: "next_turn", explainer: s.turn_player });
  }

  // GET /next_round/<game_id>
  // The same explainer carries on with their remaining time, unless < 1s is left.
  function nextRound(game, random) {
    const s = game.state;
    if (s.is_game_finished || s.round >= roundCount(s)) return fail(ERRORS.gameFinished);
    s.words_to_guess.push(...s.words_guessed.splice(0));
    shuffle(s.words_to_guess, random);
    s.round += 1;
    s.is_round_active = true;
    s.is_turn_active = false;
    const keepsTurn = s.timer >= LIMITS.keepTurnMinMs;
    if (!keepsTurn) {
      s.timer = s.turn_length;
      rotate(s);
    }
    return ok({ event: "next_round", keepsTurn, explainer: s.turn_player });
  }

  // Results — replaces static/ts/results.ts. Competition ranking (1, 1, 3):
  // tied teams share a place and a medal; places 1–3 get gold, silver, bronze.
  const MEDALS = ["gold", "silver", "bronze"];
  function standings(game) {
    const s = game.state;
    const rows = s.teams.map((players, team) => {
      const perRound = [];
      for (let r = 1; r <= roundCount(s); r++) {
        const words = (s.words_guessed_per_team_per_round[r] || {})[team] || [];
        perRound.push({ round: r, title: roundInfo(s, r).title, words: [...words] });
      }
      return { team, players: [...players], perRound, total: perRound.reduce((n, r) => n + r.words.length, 0) };
    });
    const sorted = [...rows].sort((a, b) => b.total - a.total || a.team - b.team);
    sorted.forEach((row, i) => {
      row.place = i > 0 && row.total === sorted[i - 1].total ? sorted[i - 1].place : i + 1;
      row.medal = MEDALS[row.place - 1] || null;
    });
    return sorted;
  }

  function roundScore(game, team, round = game.state.round) {
    return ((game.state.words_guessed_per_team_per_round[round] || {})[team] || []).length;
  }

  return {
    LIMITS, ROUNDS, ERRORS, rng, shuffle, byteLength, listNames,
    validateName, validateWord, validateWordLimit, validateSettings, validateGameCode, roundInfo, roundCount,
    createGame, joinGame, leaveGame, kickPlayer, addWord, deleteWord, lobbyStatus,
    startGame, teamOf, teammateOf, roleOf, upNext, turnPhase, wordsLeft, totalWords,
    updateTimer, fetchWord, guessWord, undoGuess, nextTurn, nextRound, standings, roundScore,
  };
});
