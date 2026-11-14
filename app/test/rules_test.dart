import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shapka/game/rules.dart';

/// A payload in the exact shape GET /fetch_game_state returns (serde, string map keys).
Map<String, dynamic> serverState({
  int timer = 60000,
  int turnLength = 60000,
  List<int> rounds = const [1, 2, 3],
  String turnPlayer = 'ana',
  int turnIndex = 0,
  int round = 1,
  bool turnActive = false,
  bool roundActive = true,
  bool finished = false,
  bool started = true,
  List<String> inPlay = const [],
  List<String> toGuess = const ['kite', 'sauna', 'yoga'],
  List<String> guessed = const [],
  Map<String, dynamic>? perRound,
}) =>
    {
      'timer': timer,
      'turn_length': turnLength,
      'rounds': rounds,
      'turn_player': turnPlayer,
      'turn_player_index': turnIndex,
      'words_guessed_per_team_per_round': perRound ?? {for (var r = 1; r <= rounds.length; r++) '$r': <String, dynamic>{}},
      'words_per_player': {'ana': ['kite'], 'bobi': ['sauna'], 'cveti': ['yoga'], 'dimo': <String>[]},
      'teams': started ? [['ana', 'bobi'], ['cveti', 'dimo']] : [],
      'teammates': started ? {'ana': 'bobi', 'bobi': 'ana', 'cveti': 'dimo', 'dimo': 'cveti'} : {},
      'team_member_to_team_index': started ? {'ana': 0, 'bobi': 0, 'cveti': 1, 'dimo': 1} : {},
      'player_rotation': started ? ['ana', 'cveti', 'bobi', 'dimo'] : [],
      'words_guessed': guessed,
      'words_in_play': inPlay,
      'words_to_guess': toGuess,
      'round': round,
      'is_turn_active': turnActive,
      'is_round_active': roundActive,
      'is_game_finished': finished,
      'has_game_started': started,
    };

GameState state([Map<String, dynamic>? json]) => GameState.parse(jsonEncode(json ?? serverState()));

void main() {
  group('GameState', () {
    test('parses the server payload, including settings and per-round scores', () {
      final s = state(serverState(
        turnLength: 45000,
        rounds: [1, 3],
        perRound: {'1': {'0': ['kite', 'yoga'], '1': ['sauna']}, '2': {}},
      ));
      expect(s.turnLength, 45000);
      expect(s.roundCount, 2);
      expect(s.roundKindAt(2).title, 'Act it out');
      expect(s.roundScore(0), 2);
      expect(teamTotal(s, 1), 1);
      expect(s.upNext, (explainer: 'cveti', guesser: 'dimo'));
    });

    test('a server without the settings change means 60s turns and all three rounds', () {
      final json = serverState()..remove('turn_length')..remove('rounds');
      final s = state(json);
      expect(s.turnLength, 60000);
      expect(s.rounds, [1, 2, 3]);
    });

    test('phases come from server state alone', () {
      expect(state(serverState(started: false)).phase, TurnPhase.lobby);
      expect(state().phase, TurnPhase.ready);
      expect(state(serverState(timer: 23000)).phase, TurnPhase.ready, reason: 'time carried over into a new round');
      expect(state(serverState(turnActive: true, inPlay: ['kite'])).phase, TurnPhase.live);
      expect(state(serverState(timer: 31000, inPlay: ['kite'])).phase, TurnPhase.paused);
      expect(state(serverState(timer: 0, inPlay: ['kite'])).phase, TurnPhase.timesUp);
      expect(state(serverState(roundActive: false)).phase, TurnPhase.roundOver);
      expect(state(serverState(turnActive: true, toGuess: [])).phase, TurnPhase.roundOver,
          reason: 'an empty hat ends the round before the explainer reports it');
      expect(state(serverState(finished: true, toGuess: [])).phase, TurnPhase.gameOver);
    });

    test('roles follow the turn player and their teammate', () {
      final s = state();
      expect(s.roleOf('ana'), Role.explainer);
      expect(s.roleOf('bobi'), Role.guesser);
      expect(s.roleOf('dimo'), Role.spectator);
    });

    test('guess and undo events keep a watcher copy in step with the server', () {
      final s = state(serverState(inPlay: ['kite', 'sauna'], toGuess: ['yoga']));
      s.applyGuess('kite');
      expect(s.wordsInPlay, ['sauna']);
      expect(s.roundScore(0), 1);
      expect(s.wordsLeft, 2);
      s.wordsInPlay.add('yoga');
      s.wordsToGuess.remove('yoga');
      s.applyUndo('kite');
      expect(s.wordsInPlay, ['sauna', 'kite'], reason: 'the newest word goes back in the hat when two are in play');
      expect(s.wordsToGuess, ['yoga']);
      expect(s.roundScore(0), 0);
    });
  });

  test('standings share places and medals on ties', () {
    final s = state(serverState(perRound: {'1': {'0': ['a', 'b'], '1': ['c', 'd']}, '2': {'0': ['e']}, '3': {}}));
    final table = standings(s);
    expect(table.map((r) => (r.team, r.total, r.place, r.medal)), [(0, 3, 1, Medal.gold), (1, 2, 2, Medal.silver)]);
    final tie = standings(state(serverState(perRound: {'1': {'0': ['a'], '1': ['b']}, '2': {}, '3': {}})));
    expect(tie.map((r) => r.place), [1, 1]);
    expect(table.first.perRound.map((r) => r.kind.title), ['Describe', 'One word', 'Act it out']);
  });

  test('lobby status names exactly what blocks the start', () {
    LobbyStatus status(List<String> players, Map<String, int> counts) =>
        lobbyStatus(players: players, host: players.first, wordCounts: counts, limit: 2);
    expect(status(['ana'], {'ana': 2}).blocker, BlockerKind.alone);
    expect(status(['ana', 'bobi', 'cveti'], {'ana': 2, 'bobi': 2, 'cveti': 2}).blocker, BlockerKind.odd);
    final waiting = status(['ana', 'bobi', 'cveti', 'dimo'], {'ana': 2, 'bobi': 1});
    expect(waiting.blockerMessage, 'Waiting for bobi, cveti and dimo to add words');
    expect((waiting.totalWords, waiting.targetWords), (3, 8));
    expect(status(['ana', 'bobi'], {'ana': 2, 'bobi': 2}).canStart, isTrue);
  });

  test('validation mirrors the web client and the server byte limits', () {
    expect(validateName('  Maya ').value, 'Maya');
    expect(validateName('a/b').ok, isFalse);
    expect(validateName('я' * 51).ok, isFalse, reason: '102 UTF-8 bytes');
    expect(validateName('я' * 50).ok, isTrue);
    for (final bad in ['two words', 'hi!', "it's", 'a/b', '']) {
      expect(validateWord(bad, []).ok, isFalse, reason: bad);
    }
    expect(validateWord('r2d2', []).error, "Words can't contain digits");
    expect(validateWord('Penguin', ['penguin']).ok, isFalse);
    expect(validateWord('баница', []).value, 'баница');
    expect(validateGameCode('04821').value, 4821);
    expect(validateGameCode('123456').ok, isFalse);
  });
}
