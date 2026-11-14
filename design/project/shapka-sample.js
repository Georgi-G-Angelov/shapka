// Shapka — sample players, words and preview scenarios for the prototype.
// Every scenario is built by replaying real rule calls from shapka-game.js,
// so deep links show states the server could actually produce.
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./shapka-game.js") : root.ShapkaGame);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShapkaSample = api;
})(typeof self !== "undefined" ? self : this, function (G) {
  "use strict";

  const ME = "Maya";
  const HOST = "Ani";
  const FRIENDS = ["Bobi", "Dimi", "Pesho", "Joro", "Vesi", "Niki", "Rado", "Tedi", "Kali"];

  // Single words only (the client rejects spaces, digits and punctuation).
  const WORDS = [
    "penguin", "karaoke", "banitsa", "lighthouse", "Shakira", "volcano", "sauna", "origami",
    "Dracula", "trampoline", "avocado", "Everest", "yoga", "submarine", "fireworks", "Pikachu",
    "rakia", "tornado", "hammock", "saxophone", "pyramid", "igloo", "Batman", "cactus",
    "Titanic", "kangaroo", "disco", "snowman", "Mozart", "pancake", "Gandalf", "lasagne",
    "skateboard", "mermaid", "Hogwarts", "chameleon", "bagpipes", "Sinatra", "glacier", "flamingo",
  ];

  // Shuffle that keeps order: lets scenarios choose teams and the rotation.
  const keepOrder = () => 0.999999;

  function wordsFor(index, limit) {
    return Array.from({ length: limit }, (_, i) => WORDS[(index * limit + i) % WORDS.length]);
  }

  // A lobby where `others` have joined and the listed players have added all their words.
  function buildLobby({ host = ME, me = ME, others = [], limit = 5, filled = [], turnSeconds, rounds } = {}) {
    const { game } = G.createGame({ id: 4821, host, wordLimit: limit, turnSeconds, rounds });
    others.forEach(name => G.joinGame(game, name));
    if (me !== host && !game.players.includes(me)) G.joinGame(game, me);
    game.players.forEach((name, i) => {
      if (filled.includes(name)) wordsFor(i, limit).forEach(word => G.addWord(game, name, word));
    });
    return game;
  }

  // A started 4-player game where Maya explains first to Bobi; Ani & Dimi are the other team.
  // Rotation: Maya, Ani, Bobi, Dimi.
  function buildStarted({ limit = 5, seed = 21, players = [ME, "Bobi", HOST, "Dimi"], turnSeconds, rounds } = {}) {
    const game = buildLobby({ host: HOST, others: players.filter(p => p !== HOST), limit, filled: players, turnSeconds, rounds });
    game.players.splice(0, game.players.length, ...players);
    G.startGame(game, keepOrder);
    G.shuffle(game.state.words_to_guess, G.rng(seed));
    return game;
  }

  function guessSome(game, count, { timer } = {}) {
    const name = game.state.turn_player;
    for (let i = 0; i < count && G.wordsLeft(game); i++) {
      const word = G.fetchWord(game, name).word ?? game.state.words_in_play[0];
      G.guessWord(game, name, word);
    }
    if (timer !== undefined) G.updateTimer(game, timer);
    return game;
  }

  // Plays a whole game with uneven turns so the results table has a story.
  function buildFinished({ seed = 7 } = {}) {
    const game = buildStarted({ seed, limit: 4, players: [ME, "Bobi", HOST, "Dimi", "Pesho", "Vesi"] });
    const random = G.rng(seed);
    const pace = { Maya: 4, Bobi: 4, Ani: 5, Dimi: 3, Pesho: 2, Vesi: 3 };
    let safety = 200;
    while (!game.state.is_game_finished && safety--) {
      const s = game.state;
      if (!s.is_round_active) { G.nextRound(game, random); continue; }
      guessSome(game, pace[s.turn_player] + Math.floor(random() * 2));
      if (!game.state.is_round_active) G.updateTimer(game, 12000);
      else { G.updateTimer(game, 0); G.nextTurn(game, random); }
    }
    return game;
  }

  // Deep-link scenarios: Shapka.html?screen=<name>
  const SCENARIOS = {
    home: () => ({ phase: "home" }),
    create: () => ({ phase: "create" }),
    join: () => ({ phase: "join" }),
    lobby: () => ({ phase: "lobby", me: ME, game: buildLobby({ host: ME }), live: "host" }),
    lobbyReady: () => ({
      phase: "lobby", me: ME, live: false,
      game: buildLobby({ host: ME, others: ["Bobi", "Dimi", "Pesho"], filled: [ME, "Bobi", "Dimi", "Pesho"] }),
    }),
    lobbyOdd: () => ({
      phase: "lobby", me: ME, live: false,
      game: buildLobby({ host: ME, others: ["Bobi", "Dimi"], filled: [ME, "Bobi", "Dimi"] }),
    }),
    lobbyPlayer: () => ({
      phase: "lobby", me: ME, live: "player",
      game: buildLobby({ host: HOST, others: ["Bobi"], filled: [HOST] }),
    }),
    explainer: () => ({ phase: "game", me: ME, game: buildStarted() }),
    explainerLive: () => {
      const game = buildStarted();
      guessSome(game, 3);
      G.fetchWord(game, ME);
      G.updateTimer(game, 34000, { turnActive: true });
      return { phase: "game", me: ME, game, turnGuesses: game.state.words_guessed.slice(), live: true };
    },
    timesUp: () => {
      const game = buildStarted();
      guessSome(game, 4);
      G.fetchWord(game, ME);
      G.updateTimer(game, 0, { turnActive: false });
      return { phase: "game", me: ME, game, turnGuesses: game.state.words_guessed.slice(), timesUp: true };
    },
    roundOver: () => {
      const game = buildStarted();
      guessSome(game, 6);
      G.updateTimer(game, 0); G.nextTurn(game, G.rng(1));
      guessSome(game, 5);
      G.updateTimer(game, 0); G.nextTurn(game, G.rng(2));
      guessSome(game, 4);
      G.updateTimer(game, 0); G.nextTurn(game, G.rng(3));
      guessSome(game, 3);
      G.updateTimer(game, 0); G.nextTurn(game, G.rng(4));
      guessSome(game, 99, { timer: 23000 });
      G.updateTimer(game, 23000, { turnActive: false, roundActive: false });
      return { phase: "game", me: ME, game, turnGuesses: game.state.words_guessed.slice(-2) };
    },
    guesser: () => {
      const game = buildStarted();
      guessSome(game, 4); G.updateTimer(game, 0); G.nextTurn(game, G.rng(1));
      guessSome(game, 3); G.updateTimer(game, 0); G.nextTurn(game, G.rng(2));
      guessSome(game, 2);
      G.updateTimer(game, 41000, { turnActive: true });
      return { phase: "game", me: ME, game, live: true };
    },
    spectator: () => {
      const game = buildStarted();
      guessSome(game, 4); G.updateTimer(game, 0); G.nextTurn(game, G.rng(1));
      guessSome(game, 2);
      G.updateTimer(game, 47000, { turnActive: true });
      return { phase: "game", me: ME, game, live: true };
    },
    // Advanced settings: 45s turns, Describe and Act it out only. Opens on round 2/2.
    customRounds: () => {
      const game = buildStarted({ turnSeconds: 45, rounds: [1, 3] });
      guessSome(game, 99, { timer: 0 });
      G.nextRound(game, G.rng(3));
      return { phase: "game", me: ME, game };
    },
    bigGame: () => {
      const game = buildStarted({ limit: 4, players: [ME, "Bobi", HOST, "Dimi", "Pesho", "Vesi", "Joro", "Niki", "Rado", "Tedi"] });
      for (let turn = 0; turn < 6; turn++) { guessSome(game, 1 + (turn % 3)); G.updateTimer(game, 0); G.nextTurn(game, G.rng(turn)); }
      G.updateTimer(game, 44000, { turnActive: true });
      return { phase: "game", me: ME, game, live: true };
    },
    results: () => ({ phase: "results", me: ME, game: buildFinished() }),
    resultsTie: () => ({ phase: "results", me: ME, game: buildFinished({ seed: 9 }) }),
  };

  return { ME, HOST, FRIENDS, WORDS, keepOrder, wordsFor, buildLobby, buildStarted, buildFinished, guessSome, SCENARIOS };
});
