import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shapka/api/events.dart';
import 'package:shapka/api/shapka_api.dart';

void main() {
  group('ShapkaApi', () {
    test('percent-encodes path segments and sends the token', () async {
      final seen = <http.Request>[];
      final api = ShapkaApi(
        baseUrl: 'http://host:8000',
        client: MockClient((req) async {
          seen.add(req);
          return http.Response('', 200);
        }),
      )..token = 'tok';
      await api.addWord(4821, 'Мая Б', 'баница');
      expect(seen.single.url.toString(), 'http://host:8000/add_word/4821/%D0%9C%D0%B0%D1%8F%20%D0%91/%D0%B1%D0%B0%D0%BD%D0%B8%D1%86%D0%B0');
      expect(seen.single.headers['Authorization'], 'tok');
    });

    test('create sends the advanced settings and keeps the token', () async {
      late Uri url;
      final api = ShapkaApi(
        baseUrl: 'https://example.com/',
        client: MockClient((req) async {
          url = req.url;
          expect(req.headers.containsKey('Authorization'), isFalse);
          return http.Response('{"name":"Maya","gameId":4821,"authToken":"jwt"}', 200);
        }),
      );
      final m = await api.createGame(name: 'Maya', wordLimit: 5, turnSeconds: 45, rounds: [1, 3]);
      expect(url.path, '/create_game/Maya/5/45/13');
      expect((m.gameId, m.name, m.token), (4821, 'Maya', 'jwt'));
      expect(api.token, 'jwt');
    });

    test('plain-text server errors become ApiExceptions with friendly copy', () async {
      final api = ShapkaApi(baseUrl: 'http://h', client: MockClient((req) async => http.Response('Name already exists', 400)));
      await expectLater(
        api.joinGame(gameId: 1, name: 'Ani'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Name already exists').having((e) => e.friendly, 'friendly', 'Name already exists')),
      );
      final limited = ShapkaApi(baseUrl: 'http://h', client: MockClient((req) async => http.Response('Too many requests', 429)));
      await expectLater(limited.nextTurn(1), throwsA(isA<ApiException>().having((e) => e.isRateLimited, 'rate limited', true)));
      final offline = ShapkaApi(baseUrl: 'http://h', client: MockClient((req) async => throw const SocketLike()));
      await expectLater(offline.nextTurn(1), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'network', true)));
    });

    test('words come back as plain text and is_in_game as string booleans', () async {
      final api = ShapkaApi(
        baseUrl: 'http://h',
        client: MockClient((req) async => switch (req.url.pathSegments.first) {
              'fetch_word' => http.Response('penguin', 200),
              'is_in_game' => http.Response('{"isGameActive":"true","isHost":"false"}', 200),
              _ => http.Response('?', 404),
            }),
      );
      expect(await api.fetchWord(1, 'a'), 'penguin');
      expect(await api.isInGame(1, 'a'), (active: true, host: false));
    });

    test('timer reports never send negative milliseconds', () async {
      late Uri url;
      final api = ShapkaApi(baseUrl: 'http://h', client: MockClient((req) async {
        url = req.url;
        return http.Response('0', 200);
      }));
      await api.updateTimer(7, millis: -40, turnActive: false, roundActive: true, round: 2);
      expect(url.path, '/update_timer_state/7/0/false/true/2');
    });
  });

  group('events', () {
    test('every server event prefix parses', () {
      expect(GameEvent.parse('new_player:Ani'), isA<PlayerJoined>().having((e) => e.name, 'name', 'Ani'));
      expect(GameEvent.parse('new_word:Ani/penguin'), isA<WordAdded>().having((e) => (e.name, e.word), 'w', ('Ani', 'penguin')));
      expect(GameEvent.parse('word_removed:Ani/penguin'), isA<WordRemoved>());
      expect(GameEvent.parse('player_left:Bo'), isA<PlayerLeft>());
      expect(GameEvent.parse('player_kicked:Bo'), isA<PlayerKicked>());
      expect(GameEvent.parse('timer_update:41000'), isA<TimerUpdate>().having((e) => e.millis, 'ms', 41000));
      expect(GameEvent.parse('word_guessed:kite'), isA<WordGuessed>());
      expect(GameEvent.parse('undo_guess:kite'), isA<GuessUndone>());
      expect(GameEvent.parse('start_game'), isA<GameStarted>());
      expect(GameEvent.parse('out_of_words'), isA<OutOfWords>());
      expect(GameEvent.parse('next_turn'), isA<NextTurn>());
      expect(GameEvent.parse('next_round'), isA<NextRound>());
      expect(GameEvent.parse('something_new'), isNull);
    });

    test('the SSE parser joins data lines, skips comments and unwraps JSON strings', () {
      final parser = SseParser();
      expect(parser.addLine(':'), isNull);
      expect(parser.addLine('data:"new_player:Ani"'), isNull);
      final data = parser.addLine('');
      expect(SseParser.decode(data!), 'new_player:Ani');
      expect(parser.addLine(''), isNull);
    });

    test('the stream delivers events and reconnects after the connection drops', () async {
      var connections = 0;
      final first = StreamController<List<int>>();
      final stream = GameEventStream(Uri.parse('http://h/gameevents/1'), clientFactory: () => _StreamingClient(() {
            connections++;
            if (connections == 1) return http.StreamedResponse(first.stream, 200);
            return http.StreamedResponse(Stream.value(utf8.encode('data:"next_turn"\n\n')), 200);
          }));
      final events = <GameEvent>[];
      final statuses = <StreamStatus>[];
      stream.events.listen(events.add);
      stream.statuses.listen(statuses.add);
      stream.connect();
      await pumpEventQueue();
      first.add(utf8.encode('data:"start_game"\n\n'));
      await pumpEventQueue();
      expect(events.single, isA<GameStarted>());
      await first.close();
      await pumpEventQueue();
      expect(stream.status, StreamStatus.reconnecting);
      stream.reconnectNow();
      await pumpEventQueue();
      expect(connections, 2);
      expect(events.last, isA<NextTurn>());
      expect(statuses, containsAllInOrder([StreamStatus.live, StreamStatus.reconnecting, StreamStatus.live]));
      stream.close();
    });
  });
}

class SocketLike implements Exception {
  const SocketLike();
}

class _StreamingClient extends http.BaseClient {
  _StreamingClient(this.respond);
  final http.StreamedResponse Function() respond;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async => respond();
}
