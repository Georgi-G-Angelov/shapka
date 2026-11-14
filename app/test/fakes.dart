import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shapka/api/events.dart';
import 'package:shapka/api/shapka_api.dart';
import 'package:shapka/app_state.dart';
import 'package:shapka/game/game_controller.dart';
import 'package:shapka/session/session_store.dart';

class MemoryStore extends SessionStore {
  SavedSession? saved;
  String? name;
  @override
  Future<SavedSession?> load() async => saved;
  @override
  Future<void> save(SavedSession session) async {
    saved = session;
    name = session.name;
  }

  @override
  Future<void> clear() async => saved = null;
  @override
  Future<String?> lastName() async => name;
  @override
  Future<void> saveName(String name) async => this.name = name;
}

/// A tiny in-memory stand-in for the Rust server, enough for widget tests.
class FakeServer {
  FakeServer({this.players = const ['Maya'], this.host = 'Maya', this.limit = 4});

  List<String> players;
  String host;
  int limit;
  final Map<String, List<String>> words = {};
  final requests = <Uri>[];
  Map<String, dynamic>? gameState;
  String? createError;
  String? joinError;
  final List<String> hat = [];

  http.Client get client => MockClient((req) async {
        requests.add(req.url);
        final seg = req.url.pathSegments;
        http.Response ok(Object body) => http.Response.bytes(utf8.encode(body is String ? body : jsonEncode(body)), 200);
        http.Response bad(String m) => http.Response.bytes(utf8.encode(m), 400);
        if (seg.isEmpty) return ok('<!DOCTYPE html>'); // the home page, used to wake the server
        switch (seg.first) {
          case 'create_game':
            if (createError != null) return bad(createError!);
            players = [seg[1]];
            host = seg[1];
            return ok({'name': seg[1], 'gameId': 4821, 'authToken': 'tok-${seg[1]}'});
          case 'join_game':
            if (joinError != null) return bad(joinError!);
            players = [...players, seg[2]];
            return ok({'name': seg[2], 'gameId': int.parse(seg[1]), 'authToken': 'tok-${seg[2]}'});
          case 'fetch_players':
            return ok({'players': players, 'host': host});
          case 'fetch_player_words':
            return ok({'words': words[seg[2]] ?? [], 'host': host, 'limit': limit});
          case 'add_word':
            (words[seg[2]] ??= []).add(seg[3]);
            return ok({'wordAdded': seg[3], 'wordLimit': limit});
          case 'delete_word':
            words[seg[2]]?.remove(seg[3]);
            return ok({'wordRemoved': seg[3], 'wordLimit': limit});
          case 'fetch_game_state':
            return ok(gameState ?? lobbyState());
          case 'has_game_started':
            return ok('${gameState?['has_game_started'] ?? false}');
          case 'fetch_word':
            if (hat.isEmpty) return bad('No words left');
            final w = hat.removeLast();
            (gameState!['words_in_play'] as List).add(w);
            return ok(w);
          case 'guess_word':
            (gameState!['words_in_play'] as List).remove(seg[3]);
            return ok(seg[3]);
          case 'update_timer_state':
            return ok(seg[2]);
          default:
            return ok(seg.length > 1 ? seg[1] : '');
        }
      });

  Map<String, dynamic> lobbyState() => {
        'timer': 60000,
        'turn_length': 60000,
        'rounds': [1, 2, 3],
        'turn_player': host,
        'turn_player_index': 0,
        'words_guessed_per_team_per_round': {'1': {}, '2': {}, '3': {}},
        'words_per_player': {for (final p in players) p: words[p] ?? []},
        'teams': [],
        'teammates': {},
        'team_member_to_team_index': {},
        'player_rotation': [],
        'words_guessed': [],
        'words_in_play': [],
        'words_to_guess': [],
        'round': 1,
        'is_turn_active': false,
        'is_round_active': true,
        'is_game_finished': false,
        'has_game_started': false,
      };

  /// A started 4-player game: Maya & Bobi vs Ani & Dimi, Maya explains first.
  void startGame({String turnPlayer = 'Maya', int turnLength = 60000, List<int> rounds = const [1, 2, 3]}) {
    players = ['Maya', 'Bobi', 'Ani', 'Dimi'];
    hat
      ..clear()
      ..addAll(['penguin', 'sauna', 'kite']);
    gameState = {
      ...lobbyState(),
      'timer': turnLength,
      'turn_length': turnLength,
      'rounds': rounds,
      'turn_player': turnPlayer,
      'turn_player_index': ['Maya', 'Ani', 'Bobi', 'Dimi'].indexOf(turnPlayer),
      'words_guessed_per_team_per_round': {for (var r = 1; r <= rounds.length; r++) '$r': {}},
      'teams': [['Maya', 'Bobi'], ['Ani', 'Dimi']],
      'teammates': {'Maya': 'Bobi', 'Bobi': 'Maya', 'Ani': 'Dimi', 'Dimi': 'Ani'},
      'team_member_to_team_index': {'Maya': 0, 'Bobi': 0, 'Ani': 1, 'Dimi': 1},
      'player_rotation': ['Maya', 'Ani', 'Bobi', 'Dimi'],
      'words_to_guess': List.of(hat),
      'has_game_started': true,
    };
  }

  ShapkaApi api() => ShapkaApi(baseUrl: 'http://fake', client: client);
}

/// An event stream that never connects anywhere.
GameEventStream silentEvents() => GameEventStream(Uri.parse('http://fake/gameevents/1'),
    clientFactory: () => MockClient.streaming((req, body) async => http.StreamedResponse(StreamController<List<int>>().stream, 200)));

AppState fakeApp(FakeServer server, {MemoryStore? store}) => AppState(
      store: store ?? MemoryStore(),
      apiFactory: server.api,
      controllerFactory: (api, session, store) => GameController(api: api, session: session, store: store, events: silentEvents()),
    );
