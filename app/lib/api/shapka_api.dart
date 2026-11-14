import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../game/rules.dart';

/// The hosted server (DEPLOYMENT.md).
const productionServerUrl = 'https://shapka-server.agreeablebeach-1eae2480.polandcentral.azurecontainerapps.io';

/// Server base URL: `--dart-define=SHAPKA_SERVER=https://example.com` wins.
/// Otherwise release builds use [productionServerUrl] and debug builds a local
/// `cargo run` (the Android emulator reaches the host machine at 10.0.2.2).
String defaultServerUrl() {
  const configured = String.fromEnvironment('SHAPKA_SERVER');
  if (configured.isNotEmpty) return configured;
  if (kReleaseMode) return productionServerUrl;
  if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;

  /// The server's plain-text error, e.g. "Name already exists".
  final String message;

  bool get isAuth => status == 401 || status == 403;
  bool get isRateLimited => status == 429;
  bool get isNetwork => status == 0;

  /// What to show a person.
  String get friendly {
    if (isNetwork) return "Can't reach the Shapka server. Check your connection.";
    if (isRateLimited) return 'Too many requests from this network. Try again in a minute.';
    if (isAuth) return 'This game no longer recognises you. Join again with the code.';
    if (status == 404) return 'Game not found';
    return message.isEmpty ? 'Something went wrong ($status)' : message;
  }

  @override
  String toString() => 'ApiException($status, $message)';
}

/// The result of create_game / join_game.
class Membership {
  const Membership({required this.gameId, required this.name, required this.token});
  final int gameId;
  final String name;
  final String token;

  factory Membership.fromJson(Map<String, dynamic> j) =>
      Membership(gameId: (j['gameId'] as num).toInt(), name: j['name'] as String, token: j['authToken'] as String);
}

class PlayersInfo {
  const PlayersInfo(this.players, this.host);
  final List<String> players;
  final String host;
}

class MyWords {
  const MyWords(this.words, this.limit, this.host);
  final List<String> words;
  final int limit;
  final String host;
}

/// Every endpoint the app uses. Endpoints are GETs with values as path segments;
/// authenticated ones take the token from create/join in `Authorization`.
class ShapkaApi {
  ShapkaApi({String? baseUrl, http.Client? client})
      : baseUrl = Uri.parse(baseUrl ?? defaultServerUrl()),
        _client = client ?? http.Client();

  final Uri baseUrl;
  final http.Client _client;
  String? token;

  /// Long enough for a cold start: the hosted server scales to zero when idle
  /// and takes about 25 seconds to start again (see DEPLOYMENT.md).
  static const _timeout = Duration(seconds: 40);

  Uri uri(List<Object> segments) => baseUrl.replace(
        pathSegments: [...baseUrl.pathSegments.where((s) => s.isNotEmpty), ...segments.map((s) => '$s')],
      );

  Future<String> _get(List<Object> segments, {bool auth = true}) async {
    final http.Response res;
    try {
      res = await _client.get(uri(segments), headers: {
        'Cache-Control': 'no-cache',
        if (auth && token != null) 'Authorization': token!,
      }).timeout(_timeout);
    } on Exception catch (e) {
      throw ApiException(0, '$e');
    }
    final body = utf8.decode(res.bodyBytes);
    if (res.statusCode < 200 || res.statusCode >= 300) throw ApiException(res.statusCode, body.trim());
    return body;
  }

  Future<Map<String, dynamic>> _json(List<Object> segments, {bool auth = true}) async =>
      jsonDecode(await _get(segments, auth: auth)) as Map<String, dynamic>;

  /// Wakes a server that scaled to zero, so it is ready by the time someone
  /// creates or joins a game. Failures don't matter.
  Future<void> warmUp() async {
    try {
      await _client.get(uri([])).timeout(_timeout);
    } on Exception {
      // The next real request reports any problem.
    }
  }

  // ── Lobby ──

  Future<Membership> createGame({required String name, required int wordLimit, required int turnSeconds, required List<int> rounds}) async {
    final m = Membership.fromJson(await _json(['create_game', name, wordLimit, turnSeconds, rounds.join()], auth: false));
    token = m.token;
    return m;
  }

  Future<Membership> joinGame({required int gameId, required String name}) async {
    final m = Membership.fromJson(await _json(['join_game', gameId, name], auth: false));
    token = m.token;
    return m;
  }

  Future<void> leaveGame(int gameId, String name) => _get(['leave_game', gameId, name]);
  Future<void> kickPlayer(int gameId, String host, String player) => _get(['kick_player', gameId, host, player]);

  Future<PlayersInfo> fetchPlayers(int gameId) async {
    final j = await _json(['fetch_players', gameId]);
    return PlayersInfo([for (final p in j['players'] as List) p as String], j['host'] as String);
  }

  Future<MyWords> fetchMyWords(int gameId, String name) async {
    final j = await _json(['fetch_player_words', gameId, name]);
    return MyWords([for (final w in j['words'] as List) w as String], (j['limit'] as num).toInt(), j['host'] as String);
  }

  Future<void> addWord(int gameId, String name, String word) => _get(['add_word', gameId, name, word]);
  Future<void> deleteWord(int gameId, String name, String word) => _get(['delete_word', gameId, name, word]);
  Future<void> startGame(int gameId) => _get(['start_game', gameId]);
  Future<bool> hasGameStarted(int gameId) async => (await _get(['has_game_started', gameId])).trim() == 'true';

  /// `is_in_game` answers with strings: {"isGameActive": "true", "isHost": "false"}.
  Future<({bool active, bool host})> isInGame(int gameId, String name) async {
    final j = await _json(['is_in_game', gameId, name]);
    return (active: '${j['isGameActive']}' == 'true', host: '${j['isHost']}' == 'true');
  }

  // ── Game ──

  Future<GameState> fetchGameState(int gameId) async => GameState.parse(await _get(['fetch_game_state', gameId]));

  /// The explainer's phone owns the clock and reports it here; the server
  /// rebroadcasts it to everyone as `timer_update:<ms>`.
  Future<void> updateTimer(int gameId, {required int millis, required bool turnActive, required bool roundActive, required int round}) =>
      _get(['update_timer_state', gameId, millis < 0 ? 0 : millis, turnActive, roundActive, round]);

  /// The word comes back as plain text.
  Future<String> fetchWord(int gameId, String name) => _get(['fetch_word', gameId, name]);
  Future<String> guessWord(int gameId, String name, String word) => _get(['guess_word', gameId, name, word]);
  Future<String> undoGuess(int gameId, String name) => _get(['undo_guess_word', gameId, name]);
  Future<void> nextTurn(int gameId) => _get(['next_turn', gameId]);
  Future<void> nextRound(int gameId) => _get(['next_round', gameId]);

  void close() => _client.close();
}
