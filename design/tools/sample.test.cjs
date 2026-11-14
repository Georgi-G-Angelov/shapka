const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../project/shapka-game.js");
const S = require("../project/shapka-sample.js");

test("every deep-link scenario derives the intended game phase from server state alone", () => {
  const expected = {
    lobby: "lobby", lobbyReady: "lobby", lobbyOdd: "lobby", lobbyPlayer: "lobby",
    explainer: "ready", explainerLive: "live", timesUp: "timesUp", roundOver: "roundOver",
    guesser: "live", spectator: "live", bigGame: "live", customRounds: "ready", results: "gameOver", resultsTie: "gameOver",
  };
  for (const [name, phase] of Object.entries(expected)) {
    assert.equal(G.turnPhase(S.SCENARIOS[name]().game.state), phase, name);
  }
});

test("scenarios put Maya in the role their name promises", () => {
  const role = name => G.roleOf(S.SCENARIOS[name]().game, S.ME);
  assert.equal(role("explainer"), "explainer");
  assert.equal(role("guesser"), "guesser");
  assert.equal(role("spectator"), "spectator");
  assert.equal(G.lobbyStatus(S.SCENARIOS.lobbyReady().game).canStart, true);
  assert.equal(G.lobbyStatus(S.SCENARIOS.lobbyOdd().game).blocker.kind, "odd");
});

test("a paused turn is told apart from a fresh turn and from carried-over time", () => {
  const game = S.buildStarted();
  G.fetchWord(game, S.ME);
  G.updateTimer(game, 31000, { turnActive: false });
  assert.equal(G.turnPhase(game.state), "paused");
  const carried = S.SCENARIOS.roundOver().game;
  G.nextRound(carried, G.rng(1));
  assert.equal(carried.state.timer, 23000);
  assert.equal(G.turnPhase(carried.state), "ready");
});

test("results scenarios cover a clear winner and a shared first place", () => {
  const places = name => G.standings(S.SCENARIOS[name]().game).map(row => row.place);
  assert.deepEqual(places("results"), [1, 2, 3]);
  assert.deepEqual(places("resultsTie"), [1, 1, 3]);
  assert.equal(G.standings(S.SCENARIOS.results().game)[0].players.includes(S.ME), true);
});
