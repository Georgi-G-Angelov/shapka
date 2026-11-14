const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../project/shapka-game.js");

const PLAYERS = ["Ana", "Bobi", "Cveti", "Dimo"];

function lobby({ players = PLAYERS, limit = 4 } = {}) {
  const { game } = G.createGame({ id: 4821, host: players[0], wordLimit: limit });
  players.slice(1).forEach(name => assert.ok(G.joinGame(game, name).ok));
  return game;
}

function filled(options) {
  const game = lobby(options);
  game.players.forEach(name => {
    for (let i = 0; i < game.wordLimit; i++) assert.ok(G.addWord(game, name, `${name}w${"abcdefg"[i]}`).ok);
  });
  return game;
}

function started(seed = 7, options) {
  const game = filled(options);
  assert.ok(G.startGame(game, G.rng(seed)).ok);
  return game;
}

test("client validation mirrors the web client and the server limits", () => {
  assert.equal(G.validateName("  Ana ").value, "Ana");
  assert.equal(G.validateName(" ").ok, false);
  assert.equal(G.validateName("a/b").ok, false);
  assert.equal(G.validateName("я".repeat(51)).error, G.ERRORS.nameTooLong); // 102 UTF-8 bytes
  assert.equal(G.validateWord("penguin").value, "penguin");
  for (const bad of ["two words", "hi!", "a/b", "it's", ""]) assert.equal(G.validateWord(bad).ok, false, bad);
  assert.equal(G.validateWord("r2d2").error, "Words can't contain digits");
  assert.equal(G.validateWord("Penguin", ["penguin"]).ok, false);
  assert.equal(G.validateWordLimit(3).error, G.ERRORS.limitLow);
  assert.equal(G.validateWordLimit(8).error, G.ERRORS.limitHigh);
  assert.equal(G.validateGameCode("04821").value, 4821);
  assert.equal(G.validateGameCode("123456").ok, false);
});

test("joining rejects duplicates and full games; kicking is host-only and removes words", () => {
  const game = lobby();
  assert.equal(G.joinGame(game, "Ana").error, G.ERRORS.nameTaken);
  assert.equal(G.joinGame(null, "Eli").error, G.ERRORS.gameNotFound);
  G.addWord(game, "Bobi", "kite");
  assert.equal(G.kickPlayer(game, "Bobi", "Cveti").error, G.ERRORS.onlyHostKicks);
  assert.equal(G.kickPlayer(game, "Ana", "Bobi").event, "player_kicked:Bobi");
  assert.deepEqual(game.words, []);
  assert.equal(game.state.words_per_player.Bobi, undefined);
  const crowd = lobby({ players: Array.from({ length: G.LIMITS.maxPlayers }, (_, i) => `p${i}`) });
  assert.equal(G.joinGame(crowd, "late").error, G.ERRORS.gameFull);
});

test("words respect the per-player limit and can be removed", () => {
  const game = lobby({ limit: 4 });
  ["a", "b", "c", "d"].forEach(w => assert.ok(G.addWord(game, "Ana", w).ok));
  assert.equal(G.addWord(game, "Ana", "e").error, G.ERRORS.wordLimitReached);
  assert.equal(G.deleteWord(game, "Ana", "zzz").error, G.ERRORS.wordNotFound);
  assert.equal(G.deleteWord(game, "Ana", "b").event, "word_removed:Ana/b");
  assert.deepEqual(game.state.words_per_player.Ana, ["a", "c", "d"]);
  assert.deepEqual(game.words, ["a", "c", "d"]);
});

test("lobby status explains exactly why the host cannot start yet", () => {
  const solo = G.createGame({ id: 1, host: "Ana", wordLimit: 4 }).game;
  assert.equal(G.lobbyStatus(solo).blocker.kind, "alone");
  const odd = filled({ players: ["Ana", "Bobi", "Cveti"] });
  assert.equal(G.lobbyStatus(odd).blocker.kind, "odd");
  assert.equal(G.startGame(odd, G.rng(1)).error, G.ERRORS.oddPlayers);
  const waiting = lobby();
  G.addWord(waiting, "Ana", "kite");
  const status = G.lobbyStatus(waiting);
  assert.equal(status.blocker.message, "Waiting for Ana, Bobi and 2 others to add words");
  assert.deepEqual(status.progress.map(p => p.have), [1, 0, 0, 0]);
  assert.equal(G.startGame(waiting, G.rng(1)).error, G.ERRORS.missingWords);
  assert.equal(G.lobbyStatus(filled()).canStart, true);
});

test("starting pairs players into teams and rotates first players before second players", () => {
  const game = started(3);
  const s = game.state;
  assert.equal(s.has_game_started, true);
  assert.equal(s.teams.length, 2);
  assert.deepEqual(s.player_rotation, [s.teams[0][0], s.teams[1][0], s.teams[0][1], s.teams[1][1]]);
  for (const [a, b] of s.teams) {
    assert.equal(s.teammates[a], b);
    assert.equal(s.team_member_to_team_index[a], s.team_member_to_team_index[b]);
  }
  assert.equal(s.turn_player, s.player_rotation[0]);
  assert.equal(s.words_to_guess.length, 16);
  assert.deepEqual(game.words, []);
  assert.equal(G.roleOf(game, s.turn_player), "explainer");
  assert.equal(G.roleOf(game, s.teammates[s.turn_player]), "guesser");
  assert.equal(G.roleOf(game, s.teams[1][0]), "spectator");
  assert.deepEqual(G.upNext(game), { explainer: s.teams[1][0], guesser: s.teams[1][1] });
});

test("the explainer holds at most two words and guesses score for their team", () => {
  const game = started();
  const s = game.state;
  const me = s.turn_player;
  assert.equal(G.fetchWord(game, s.teams[1][0]).error, G.ERRORS.notTurnPlayer);
  const first = G.fetchWord(game, me).word;
  G.fetchWord(game, me);
  assert.equal(G.fetchWord(game, me).error, G.ERRORS.enoughInPlay);
  assert.equal(G.guessWord(game, me, "nope").error, G.ERRORS.wordNotInPlay);
  const guessed = G.guessWord(game, me, first);
  assert.deepEqual(guessed.events, [`word_guessed:${first}`]);
  assert.equal(G.roundScore(game, G.teamOf(game, me)), 1);
  assert.equal(G.wordsLeft(game), 15);
  assert.equal(G.totalWords(game), 16);
});

test("undo returns the word to play and parks the newest word when two are in play", () => {
  const game = started();
  const me = game.state.turn_player;
  assert.equal(G.undoGuess(game, me).error, G.ERRORS.nothingToUndo);
  const a = G.fetchWord(game, me).word;
  G.guessWord(game, me, a);
  const b = G.fetchWord(game, me).word;
  const c = G.fetchWord(game, me).word;
  assert.equal(G.undoGuess(game, me).event, `undo_guess:${a}`);
  assert.deepEqual(game.state.words_in_play, [b, a]);
  assert.equal(game.state.words_to_guess.at(-1), c);
  assert.equal(G.roundScore(game, G.teamOf(game, me)), 0);
});

test("next turn rotates, resets the clock and puts unguessed words back in the hat", () => {
  const game = started();
  const s = game.state;
  const [first, second] = s.player_rotation;
  G.fetchWord(game, first);
  G.updateTimer(game, 0, { turnActive: false });
  G.nextTurn(game, G.rng(2));
  assert.equal(s.turn_player, second);
  assert.equal(s.timer, G.LIMITS.timerStartMs);
  assert.deepEqual(s.words_in_play, []);
  assert.equal(s.words_to_guess.length, 16);
  for (let i = 0; i < s.player_rotation.length - 1; i++) G.nextTurn(game, G.rng(i));
  assert.equal(s.turn_player, first, "rotation wraps around");
});

function playOutRound(game) {
  const me = game.state.turn_player;
  let result;
  while (G.wordsLeft(game)) {
    const word = G.fetchWord(game, me).word ?? game.state.words_in_play[0];
    result = G.guessWord(game, me, word);
  }
  return result;
}

test("emptying the hat ends the round; next round keeps the turn only with a second left", () => {
  const game = started();
  const s = game.state;
  const me = s.turn_player;
  const end = playOutRound(game);
  assert.equal(end.roundOver, true);
  assert.equal(end.gameOver, false);
  assert.deepEqual(end.events.at(-1), "out_of_words");
  G.updateTimer(game, 23000, { roundActive: false });
  const kept = G.nextRound(game, G.rng(4));
  assert.equal(kept.keepsTurn, true);
  assert.equal(s.turn_player, me);
  assert.equal(s.timer, 23000);
  assert.equal(s.round, 2);
  assert.equal(s.words_to_guess.length, 16);
  assert.deepEqual(s.words_guessed, []);
  playOutRound(game);
  G.updateTimer(game, 999);
  const passed = G.nextRound(game, G.rng(5));
  assert.equal(passed.keepsTurn, false);
  assert.equal(s.turn_player, s.player_rotation[1]);
  assert.equal(s.timer, G.LIMITS.timerStartMs);
});

test("the third round ends the game and standings share places on ties", () => {
  const game = started(11);
  const s = game.state;
  playOutRound(game);
  G.nextRound(game, G.rng(1));
  playOutRound(game);
  G.nextRound(game, G.rng(2));
  const last = playOutRound(game);
  assert.equal(last.gameOver, true);
  assert.equal(s.is_game_finished, true);
  assert.equal(G.nextRound(game, G.rng(3)).error, G.ERRORS.gameFinished);
  const table = G.standings(game);
  assert.equal(table[0].total, 48);
  assert.deepEqual(table.map(r => [r.place, r.medal]), [[1, "gold"], [2, "silver"]]);
  assert.deepEqual(table[0].perRound.map(r => r.words.length), [16, 16, 16]);

  const tie = started(12, { players: ["A", "B", "C", "D", "E", "F"] });
  tie.state.words_guessed_per_team_per_round[1] = { 0: ["x", "y"], 1: ["z", "w"], 2: ["v"] };
  assert.deepEqual(G.standings(tie).map(r => [r.team, r.place, r.medal]),
    [[0, 1, "gold"], [1, 1, "gold"], [2, 3, "bronze"]]);
});

test("advanced settings: turn length and a subset of rounds drive the clock, round count and results", () => {
  assert.equal(G.validateSettings({ turnSeconds: 50 }).error, G.ERRORS.badTurnLength);
  assert.equal(G.validateSettings({ rounds: [] }).error, G.ERRORS.noRounds);
  assert.equal(G.validateSettings({ rounds: [4] }).error, G.ERRORS.noRounds);
  assert.deepEqual(G.validateSettings({ turnSeconds: 45, rounds: [3, 1, 3] }).value, { turnMs: 45000, rounds: [1, 3] });

  const { game } = G.createGame({ id: 1, host: "Ana", wordLimit: 4, turnSeconds: 30, rounds: [1, 3] });
  ["Bobi", "Cveti", "Dimo"].forEach(name => G.joinGame(game, name));
  game.players.forEach(name => ["a", "b", "c", "d"].forEach(w => G.addWord(game, name, name + w)));
  G.startGame(game, G.rng(1));
  const s = game.state;
  assert.equal(s.timer, 30000);
  assert.equal(G.roundCount(s), 2);
  assert.equal(G.roundInfo(s).title, "Describe");
  const me = s.turn_player;
  G.fetchWord(game, me);
  G.updateTimer(game, 20000, { turnActive: false });
  assert.equal(G.turnPhase(s), "paused");
  G.nextTurn(game, G.rng(2));
  assert.equal(s.timer, 30000);
  assert.equal(G.turnPhase(s), "ready");
  playOutRound(game);
  G.updateTimer(game, 500);
  G.nextRound(game, G.rng(3));
  assert.equal(s.timer, 30000, "a new explainer gets the configured turn length");
  assert.equal(G.roundInfo(s).title, "Act it out");
  assert.equal(playOutRound(game).gameOver, true, "the last chosen round ends the game");
  assert.equal(G.nextRound(game, G.rng(4)).error, G.ERRORS.gameFinished);
  assert.deepEqual(G.standings(game)[0].perRound.map(r => r.title), ["Describe", "Act it out"]);
});
