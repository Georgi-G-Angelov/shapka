import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// A message from `GET /gameevents/<id>`. Each SSE `data:` line is a JSON
/// string such as `"new_word:Ani/penguin"` (src/constants.rs prefixes).
sealed class GameEvent {
  const GameEvent();

  static GameEvent? parse(String message) {
    String after(String prefix) => message.substring(prefix.length);
    // new_word / word_removed carry "<name>/<word>"; names can't contain "/".
    (String, String) split(String v) {
      final i = v.indexOf('/');
      return i < 0 ? (v, '') : (v.substring(0, i), v.substring(i + 1));
    }

    if (message.startsWith('new_player:')) return PlayerJoined(after('new_player:'));
    if (message.startsWith('player_left:')) return PlayerLeft(after('player_left:'));
    if (message.startsWith('player_kicked:')) return PlayerKicked(after('player_kicked:'));
    if (message.startsWith('new_word:')) {
      final (name, word) = split(after('new_word:'));
      return WordAdded(name, word);
    }
    if (message.startsWith('word_removed:')) {
      final (name, word) = split(after('word_removed:'));
      return WordRemoved(name, word);
    }
    if (message.startsWith('timer_update:')) {
      final ms = int.tryParse(after('timer_update:'));
      return ms == null ? null : TimerUpdate(ms);
    }
    if (message.startsWith('word_guessed:')) return WordGuessed(after('word_guessed:'));
    if (message.startsWith('undo_guess:')) return GuessUndone(after('undo_guess:'));
    switch (message) {
      case 'start_game':
        return const GameStarted();
      case 'out_of_words':
        return const OutOfWords();
      case 'next_turn':
        return const NextTurn();
      case 'next_round':
        return const NextRound();
    }
    return null;
  }
}

class PlayerJoined extends GameEvent {
  const PlayerJoined(this.name);
  final String name;
}

class PlayerLeft extends GameEvent {
  const PlayerLeft(this.name);
  final String name;
}

class PlayerKicked extends GameEvent {
  const PlayerKicked(this.name);
  final String name;
}

class WordAdded extends GameEvent {
  const WordAdded(this.name, this.word);
  final String name;
  final String word;
}

class WordRemoved extends GameEvent {
  const WordRemoved(this.name, this.word);
  final String name;
  final String word;
}

class GameStarted extends GameEvent {
  const GameStarted();
}

class TimerUpdate extends GameEvent {
  const TimerUpdate(this.millis);
  final int millis;
}

class WordGuessed extends GameEvent {
  const WordGuessed(this.word);
  final String word;
}

class GuessUndone extends GameEvent {
  const GuessUndone(this.word);
  final String word;
}

class OutOfWords extends GameEvent {
  const OutOfWords();
}

class NextTurn extends GameEvent {
  const NextTurn();
}

class NextRound extends GameEvent {
  const NextRound();
}

enum StreamStatus { connecting, live, reconnecting, closed }

/// Incremental SSE parser: feed lines, get the `data` of each completed event.
class SseParser {
  final _data = <String>[];

  /// Returns the event's data when [line] completes an event.
  String? addLine(String line) {
    if (line.isEmpty) {
      if (_data.isEmpty) return null;
      final data = _data.join('\n');
      _data.clear();
      return data;
    }
    if (line.startsWith(':')) return null; // comment / heartbeat
    final colon = line.indexOf(':');
    final field = colon < 0 ? line : line.substring(0, colon);
    var value = colon < 0 ? '' : line.substring(colon + 1);
    if (value.startsWith(' ')) value = value.substring(1);
    if (field == 'data') _data.add(value);
    return null;
  }

  /// Rocket's Event::json wraps the message in a JSON string.
  static String decode(String data) {
    try {
      final v = jsonDecode(data);
      return v is String ? v : data;
    } on FormatException {
      return data;
    }
  }
}

/// Subscribes to a game's events and reconnects with exponential backoff
/// (1s → 64s, as static/ts/utils/general_utils.ts). Listeners should refetch
/// state whenever the status returns to [StreamStatus.live]: events sent while
/// disconnected are lost.
class GameEventStream {
  GameEventStream(this.url, {http.Client Function()? clientFactory}) : _clientFactory = clientFactory ?? http.Client.new;

  final Uri url;
  final http.Client Function() _clientFactory;
  final _events = StreamController<GameEvent>.broadcast();
  final _status = StreamController<StreamStatus>.broadcast();
  StreamStatus status = StreamStatus.connecting;
  http.Client? _client;
  StreamSubscription<String>? _lines;
  Timer? _retry;
  int _backoff = 1;
  bool _closed = false;

  Stream<GameEvent> get events => _events.stream;
  Stream<StreamStatus> get statuses => _status.stream;

  void _set(StreamStatus s) {
    if (status == s) return;
    status = s;
    if (!_status.isClosed) _status.add(s);
  }

  void connect() {
    if (_closed) return;
    _retry?.cancel();
    _lines?.cancel();
    _client?.close();
    final client = _client = _clientFactory();
    final request = http.Request('GET', url)
      ..headers['Accept'] = 'text/event-stream'
      ..headers['Cache-Control'] = 'no-cache';
    client.send(request).then((res) {
      if (_closed || client != _client) return;
      if (res.statusCode != 200) {
        _scheduleRetry();
        return;
      }
      _backoff = 1;
      _set(StreamStatus.live);
      final parser = SseParser();
      _lines = res.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          final data = parser.addLine(line);
          if (data == null) return;
          final event = GameEvent.parse(SseParser.decode(data));
          if (event != null && !_events.isClosed) _events.add(event);
        },
        onError: (_) => _scheduleRetry(),
        onDone: _scheduleRetry,
        cancelOnError: true,
      );
    }, onError: (_) {
      if (client == _client) _scheduleRetry();
    });
  }

  void _scheduleRetry() {
    if (_closed) return;
    _set(StreamStatus.reconnecting);
    _retry?.cancel();
    final wait = _backoff;
    _backoff = (_backoff * 2).clamp(1, 64);
    _retry = Timer(Duration(seconds: wait), connect);
  }

  /// Reconnects now (e.g. when the app returns to the foreground).
  void reconnectNow() {
    _backoff = 1;
    connect();
  }

  void close() {
    _closed = true;
    _retry?.cancel();
    _lines?.cancel();
    _client?.close();
    _set(StreamStatus.closed);
    _events.close();
    _status.close();
  }
}
