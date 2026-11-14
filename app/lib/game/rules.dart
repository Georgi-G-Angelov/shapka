/// Client-side game rules. The server is authoritative; these mirror its
/// constants and derive what each screen shows from `GET /fetch_game_state`,
/// so a phone that reconnects or rejoins lands on the same view as everyone.
library;

import 'dart:convert';

/// src/constants.rs
class Limits {
  static const int defaultTurnMs = 60000;
  static const List<int> turnSeconds = [30, 45, 60, 90, 120];
  static const int defaultTurnSeconds = 60;
  static const int maxWordsInPlay = 2;
  static const int minWordsPerPlayer = 4;
  static const int maxWordsPerPlayer = 7;
  static const int defaultWordsPerPlayer = 5;
  static const int maxWordBytes = 100;
  static const int maxNameBytes = 100;
  static const int maxPlayers = 20;
  static const int maxGameId = 100000;

  /// next_round keeps the explainer's turn only with at least this much time left.
  static const int keepTurnMinMs = 1000;
}

/// The three kinds of round. A game plays any non-empty subset, in this order.
class RoundKind {
  const RoundKind(this.number, this.title, this.rule);
  final int number;
  final String title;
  final String rule;

  static const describe = RoundKind(1, 'Describe', 'Say anything except the word itself.');
  static const oneWord = RoundKind(2, 'One word', 'Give a single-word clue.');
  static const actItOut = RoundKind(3, 'Act it out', 'No words at all, just gestures.');
  static const all = [describe, oneWord, actItOut];

  static RoundKind of(int number) => all[(number - 1).clamp(0, all.length - 1)];
}

enum TurnPhase { lobby, ready, live, paused, timesUp, roundOver, gameOver }

enum Role { explainer, guesser, spectator }

/// Mirror of the server's GameState (serde snake_case).
class GameState {
  GameState({
    required this.timer,
    required this.turnLength,
    required this.rounds,
    required this.turnPlayer,
    required this.turnPlayerIndex,
    required this.guessedPerTeamPerRound,
    required this.wordsPerPlayer,
    required this.teams,
    required this.teammates,
    required this.teamOfPlayer,
    required this.playerRotation,
    required this.wordsGuessed,
    required this.wordsInPlay,
    required this.wordsToGuess,
    required this.round,
    required this.isTurnActive,
    required this.isRoundActive,
    required this.isGameFinished,
    required this.hasGameStarted,
  });

  int timer;
  final int turnLength;
  final List<int> rounds;
  String turnPlayer;
  int turnPlayerIndex;

  /// round (1-based position) -> team index -> words guessed.
  final Map<int, Map<int, List<String>>> guessedPerTeamPerRound;
  final Map<String, List<String>> wordsPerPlayer;
  final List<List<String>> teams;
  final Map<String, String> teammates;
  final Map<String, int> teamOfPlayer;
  final List<String> playerRotation;
  final List<String> wordsGuessed;
  final List<String> wordsInPlay;
  final List<String> wordsToGuess;
  int round;
  bool isTurnActive;
  bool isRoundActive;
  bool isGameFinished;
  bool hasGameStarted;

  factory GameState.fromJson(Map<String, dynamic> j) {
    List<String> strings(Object? v) => [for (final x in (v as List? ?? const [])) x as String];
    final perRound = <int, Map<int, List<String>>>{};
    (j['words_guessed_per_team_per_round'] as Map? ?? const {}).forEach((round, teams) {
      perRound[int.parse('$round')] = {
        for (final e in (teams as Map).entries) int.parse('${e.key}'): strings(e.value),
      };
    });
    final rounds = [for (final r in (j['rounds'] as List? ?? const [1, 2, 3])) (r as num).toInt()];
    return GameState(
      timer: (j['timer'] as num).toInt(),
      // Servers before the game-settings change have neither field.
      turnLength: (j['turn_length'] as num?)?.toInt() ?? Limits.defaultTurnMs,
      rounds: rounds.isEmpty ? [1, 2, 3] : rounds,
      turnPlayer: j['turn_player'] as String,
      turnPlayerIndex: (j['turn_player_index'] as num).toInt(),
      guessedPerTeamPerRound: perRound,
      wordsPerPlayer: {
        for (final e in (j['words_per_player'] as Map? ?? const {}).entries) '${e.key}': strings(e.value),
      },
      teams: [for (final t in (j['teams'] as List? ?? const [])) strings(t)],
      teammates: {for (final e in (j['teammates'] as Map? ?? const {}).entries) '${e.key}': e.value as String},
      teamOfPlayer: {
        for (final e in (j['team_member_to_team_index'] as Map? ?? const {}).entries) '${e.key}': (e.value as num).toInt(),
      },
      playerRotation: strings(j['player_rotation']),
      wordsGuessed: strings(j['words_guessed']),
      wordsInPlay: strings(j['words_in_play']),
      wordsToGuess: strings(j['words_to_guess']),
      round: (j['round'] as num).toInt(),
      isTurnActive: j['is_turn_active'] as bool,
      isRoundActive: j['is_round_active'] as bool,
      isGameFinished: j['is_game_finished'] as bool,
      hasGameStarted: j['has_game_started'] as bool,
    );
  }

  static GameState parse(String body) => GameState.fromJson(jsonDecode(body) as Map<String, dynamic>);

  int get roundCount => rounds.length;
  RoundKind roundKindAt(int position) => RoundKind.of(rounds[(position - 1).clamp(0, rounds.length - 1)]);
  RoundKind get roundKind => roundKindAt(round);
  bool get isLastRound => round >= roundCount;

  int get wordsLeft => wordsInPlay.length + wordsToGuess.length;
  int get totalWords => wordsLeft + wordsGuessed.length;

  int? teamOf(String name) => teamOfPlayer[name];
  String? teammateOf(String name) => teammates[name];

  Role roleOf(String name) {
    if (turnPlayer == name) return Role.explainer;
    if (teammates[turnPlayer] == name) return Role.guesser;
    return Role.spectator;
  }

  /// The pair who play after the current turn (null before teams exist).
  ({String explainer, String guesser})? get upNext {
    if (playerRotation.isEmpty) return null;
    final explainer = playerRotation[(turnPlayerIndex + 1) % playerRotation.length];
    return (explainer: explainer, guesser: teammates[explainer] ?? '');
  }

  int roundScore(int team, [int? atRound]) => guessedPerTeamPerRound[atRound ?? round]?[team]?.length ?? 0;

  /// The whole game screen is derived from this. An empty hat means the round
  /// is over even before the explainer's phone reports round_active=false.
  /// A paused turn always holds a word: a live turn draws one whenever none is in play.
  TurnPhase get phase {
    if (!hasGameStarted) return TurnPhase.lobby;
    if (isGameFinished) return TurnPhase.gameOver;
    if (!isRoundActive || (wordsInPlay.isEmpty && wordsToGuess.isEmpty)) return TurnPhase.roundOver;
    if (timer <= 0) return TurnPhase.timesUp;
    if (isTurnActive) return TurnPhase.live;
    if (timer < turnLength && wordsInPlay.isNotEmpty) return TurnPhase.paused;
    return TurnPhase.ready;
  }

  /// Applies a `word_guessed:<word>` event to a watcher's copy of the state.
  void applyGuess(String word) {
    final team = teamOf(turnPlayer);
    if (!wordsInPlay.remove(word)) wordsToGuess.remove(word);
    wordsGuessed.add(word);
    if (team != null) (guessedPerTeamPerRound[round] ??= {}).putIfAbsent(team, () => []).add(word);
  }

  /// Applies an `undo_guess:<word>` event.
  void applyUndo(String word) {
    final team = teamOf(turnPlayer);
    wordsGuessed.remove(word);
    if (team != null) guessedPerTeamPerRound[round]?[team]?.remove(word);
    if (wordsInPlay.length >= Limits.maxWordsInPlay) wordsToGuess.add(wordsInPlay.removeLast());
    wordsInPlay.add(word);
  }
}

/// One row of the results table.
class Standing {
  Standing({required this.team, required this.players, required this.perRound, required this.total});
  final int team;
  final List<String> players;
  final List<({int round, RoundKind kind, List<String> words})> perRound;
  final int total;
  int place = 0;
  Medal? medal;
}

enum Medal { gold, silver, bronze }

/// Competition ranking (1, 1, 3): tied teams share a place and a medal.
List<Standing> standings(GameState s) {
  final rows = <Standing>[];
  for (var team = 0; team < s.teams.length; team++) {
    final perRound = [
      for (var r = 1; r <= s.roundCount; r++)
        (round: r, kind: s.roundKindAt(r), words: List<String>.of(s.guessedPerTeamPerRound[r]?[team] ?? const <String>[])),
    ];
    rows.add(Standing(
      team: team,
      players: List.of(s.teams[team]),
      perRound: perRound,
      total: perRound.fold(0, (n, r) => n + r.words.length),
    ));
  }
  rows.sort((a, b) => b.total != a.total ? b.total - a.total : a.team - b.team);
  for (var i = 0; i < rows.length; i++) {
    rows[i].place = i > 0 && rows[i].total == rows[i - 1].total ? rows[i - 1].place : i + 1;
    rows[i].medal = rows[i].place <= 3 ? Medal.values[rows[i].place - 1] : null;
  }
  return rows;
}

int teamTotal(GameState s, int team) {
  var n = 0;
  for (final r in s.guessedPerTeamPerRound.values) {
    n += r[team]?.length ?? 0;
  }
  return n;
}

// ── Lobby ──────────────────────────────────────────────────────────────────

class PlayerProgress {
  const PlayerProgress({required this.name, required this.have, required this.need, required this.isHost});
  final String name;
  final int have;
  final int need;
  final bool isHost;
  bool get done => have >= need;
}

enum BlockerKind { alone, odd, words }

class LobbyStatus {
  LobbyStatus({required this.progress, required this.blocker, required this.blockerMessage});
  final List<PlayerProgress> progress;
  final BlockerKind? blocker;
  final String? blockerMessage;
  bool get canStart => blocker == null;
  int get count => progress.length;
  int get totalWords => progress.fold(0, (n, p) => n + p.have);
  int get targetWords => progress.fold(0, (n, p) => n + p.need);
}

/// Why the host can't start yet, mirroring start_game's checks.
LobbyStatus lobbyStatus({required List<String> players, required String host, required Map<String, int> wordCounts, required int limit}) {
  final progress = [
    for (final p in players) PlayerProgress(name: p, have: wordCounts[p] ?? 0, need: limit, isHost: p == host),
  ];
  final waiting = [for (final p in progress) if (!p.done) p.name];
  BlockerKind? kind;
  String? message;
  if (players.length < 2) {
    kind = BlockerKind.alone;
    message = 'Invite at least one more player';
  } else if (players.length.isOdd) {
    kind = BlockerKind.odd;
    message = 'Teams are pairs: you need an even number of players (${players.length} joined)';
  } else if (waiting.isNotEmpty) {
    kind = BlockerKind.words;
    message = 'Waiting for ${listNames(waiting)} to add words';
  }
  return LobbyStatus(progress: progress, blocker: kind, blockerMessage: message);
}

String listNames(List<String> names) {
  if (names.length <= 1) return names.join();
  if (names.length == 2) return '${names[0]} and ${names[1]}';
  if (names.length == 3) return '${names[0]}, ${names[1]} and ${names[2]}';
  return '${names[0]}, ${names[1]} and ${names.length - 2} others';
}

String possessive(String name) => name.toLowerCase().endsWith('s') ? "$name'" : "$name's";

// ── Validation (static/ts/utils/string_utils.ts + server limits) ───────────

class Validated<T> {
  const Validated.ok(T this.value) : error = null;
  const Validated.fail(String this.error) : value = null;
  final T? value;
  final String? error;
  bool get ok => error == null;
}

/// Rust's str::len() counts UTF-8 bytes, so Cyrillic names hit the limit sooner.
int byteLength(String s) => utf8.encode(s).length;

const _punctuation = ";:.,?!-'\"(){}/";

Validated<String> validateName(String raw) {
  final v = raw.trim();
  if (v.isEmpty) return const Validated.fail('Enter your name');
  if (v.contains('/')) return const Validated.fail("Names can't contain /");
  if (byteLength(v) > Limits.maxNameBytes) return const Validated.fail('Player name is too long. Max length is 100');
  return Validated.ok(v);
}

Validated<String> validateWord(String raw, List<String> existing) {
  final v = raw.trim();
  if (v.isEmpty) return const Validated.fail('Type a word first');
  if (v.runes.any((r) => ' \t\n'.contains(String.fromCharCode(r)) || _punctuation.contains(String.fromCharCode(r)))) {
    return const Validated.fail('One word only, without spaces or punctuation');
  }
  if (RegExp(r'[0-9]').hasMatch(v)) return const Validated.fail("Words can't contain digits");
  if (byteLength(v) > Limits.maxWordBytes) return const Validated.fail('Word is too long. Max length is 100');
  if (existing.any((w) => w.toLowerCase() == v.toLowerCase())) return Validated.fail('You already added "$v"');
  return Validated.ok(v);
}

Validated<int> validateGameCode(String raw) {
  final v = raw.trim();
  if (!RegExp(r'^\d{1,5}$').hasMatch(v)) return const Validated.fail('Game codes are up to 5 digits');
  return Validated.ok(int.parse(v));
}
