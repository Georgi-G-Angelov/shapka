import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/events.dart';
import '../api/shapka_api.dart';
import '../game/rules.dart';
import '../session/session_store.dart';

enum NoticeKind { info, success, error }

/// A one-off message for the UI (toast) or a moment it should react to.
class Notice {
  const Notice(this.text, {this.kind = NoticeKind.info, this.icon});
  final String text;
  final NoticeKind kind;
  final String? icon;
}

/// Where the session is: the router shows the matching screen.
enum Stage { loading, lobby, game, results, gone }

/// Owns one joined game: lobby data, game state, the event stream, and — when
/// this phone explains — the turn clock. Every view derives from
/// [GameState.phase], so after any reconnect or app resume the controller just
/// refetches and the UI lands where everyone else is.
class GameController extends ChangeNotifier {
  GameController({
    required this.api,
    required this.session,
    required this.store,
    GameEventStream? events,
    this.clockReport = const Duration(seconds: 1),
    this.lobbyPoll = const Duration(seconds: 5),
    this.gamePoll = const Duration(seconds: 20),
  }) : _events = events ?? GameEventStream(api.uri(['gameevents', session.gameId])) {
    api.token = session.token;
  }

  final ShapkaApi api;
  final SavedSession session;
  final SessionStore store;
  final GameEventStream _events;

  /// How often the explainer reports the clock (the web client used 500ms;
  /// a party shares one IP and the server's per-IP limit is 400 requests/min).
  final Duration clockReport;
  final Duration lobbyPoll;
  final Duration gamePoll;

  int get gameId => session.gameId;
  String get me => session.name;

  Stage stage = Stage.loading;
  StreamStatus connection = StreamStatus.connecting;
  String? loadError;

  // Lobby
  List<String> players = [];
  String host = '';
  List<String> myWords = [];
  int wordLimit = Limits.defaultWordsPerPlayer;
  Map<String, int> wordCounts = {};
  bool get isHost => host == me;

  // Game
  GameState? state;

  /// Words guessed in the current turn (from this phone or from events).
  List<String> turnGuesses = [];

  /// Set when the game starts on this phone: show who your partner is.
  bool showTeamReveal = false;

  final _notices = StreamController<Notice>.broadcast();
  final _alarms = StreamController<bool>.broadcast();
  Stream<Notice> get notices => _notices.stream;

  /// true: time's up on this phone (ring); false: stop ringing.
  Stream<bool> get alarms => _alarms.stream;

  final List<StreamSubscription<Object?>> _subs = [];
  Timer? _poll;
  Timer? _ticker;
  bool _disposed = false;
  bool _busy = false;
  bool get busy => _busy;

  // Explainer clock
  final Stopwatch _clock = Stopwatch();
  int _clockStartMs = 0;
  int _lastReportAt = 0;
  bool get ticking => _ticker != null && _clock.isRunning;

  // Watcher clock: smooth between timer_update events.
  int _watchMs = 0;
  DateTime? _watchAt;
  bool _staleChecked = false;

  // ── Lifecycle ──

  Future<void> open() async {
    _subs.add(_events.events.listen(_onEvent));
    _subs.add(_events.statuses.listen((s) {
      final wasDown = connection != StreamStatus.live;
      connection = s;
      if (s == StreamStatus.live && wasDown) refresh();
      _notify();
    }));
    _events.connect();
    await refresh();
  }

  /// The app came back to the foreground: events may have been missed.
  void resumed() {
    _events.reconnectNow();
    refresh();
  }

  @override
  void dispose() {
    _disposed = true;
    _stopClock();
    _ticker?.cancel();
    _ticker = null;
    _poll?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    _events.close();
    _notices.close();
    _alarms.close();
    super.dispose();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _say(String text, {NoticeKind kind = NoticeKind.info, String? icon}) {
    if (!_notices.isClosed) _notices.add(Notice(text, kind: kind, icon: icon));
  }

  void _fail(Object e) {
    final message = e is ApiException ? e.friendly : '$e';
    _say(message, kind: NoticeKind.error);
  }

  Future<T?> _run<T>(Future<T> Function() action) async {
    if (_busy) return null;
    _busy = true;
    _notify();
    try {
      return await action();
    } on ApiException catch (e) {
      if (e.isAuth || e.status == 404) {
        await _gone("You're no longer in this game");
      } else {
        _fail(e);
      }
      return null;
    } finally {
      _busy = false;
      _notify();
    }
  }

  // ── Loading ──

  Future<void>? _refreshing;
  bool _refreshAgain = false;

  /// Events (other than clock ticks) seen so far; a refresh that overlaps one
  /// may hold an older snapshot, so it runs again.
  int _eventSeq = 0;

  /// Refetches everything the current stage needs. Safe to call any time:
  /// calls made while one is running share it and trigger one more pass.
  Future<void> refresh() {
    if (_refreshing != null) {
      _refreshAgain = true;
      return _refreshing!;
    }
    return _refreshing = _refreshLoop().whenComplete(() => _refreshing = null);
  }

  Future<void> _refreshLoop() async {
    var passes = 0;
    do {
      _refreshAgain = false;
      final seq = _eventSeq;
      await _refreshOnce();
      if (_eventSeq != seq) _refreshAgain = true;
    } while (_refreshAgain && !_disposed && stage != Stage.gone && ++passes < 4);
  }

  Future<void> _refreshOnce() async {
    if (_disposed || stage == Stage.gone) return;
    try {
      final next = await api.fetchGameState(gameId);
      if (_disposed) return;
      if (!next.hasGameStarted) {
        // Players first: asking for the words of someone who was removed is an error.
        final info = await api.fetchPlayers(gameId);
        if (!info.players.contains(me)) {
          await _gone('You were removed from game $gameId');
          return;
        }
        final words = await api.fetchMyWords(gameId, me);
        players = info.players;
        host = info.host;
        myWords = words.words;
        wordLimit = words.limit;
        wordCounts = {for (final e in next.wordsPerPlayer.entries) e.key: e.value.length};
        state = next;
        _enter(Stage.lobby);
      } else {
        if (host.isEmpty) host = (await api.fetchPlayers(gameId)).host;
        _adoptGameState(next);
        if (stage == Stage.lobby || stage == Stage.loading) {
          if (stage == Stage.lobby) showTeamReveal = true;
          _enter(Stage.game);
        }
      }
      loadError = null;
    } on ApiException catch (e) {
      if (e.isAuth || e.status == 404) {
        await _gone('Game $gameId has ended');
        return;
      }
      loadError = e.friendly;
    }
    _notify();
  }

  void _adoptGameState(GameState next) {
    final previous = state;
    if (ticking && previous != null) {
      // This phone's clock is the source of truth while it runs.
      next.timer = previous.timer;
      next.isTurnActive = true;
    }
    // "This turn" counts restart with each turn and each round.
    if (previous != null && (previous.turnPlayer != next.turnPlayer || previous.round != next.round)) turnGuesses = [];
    state = next;
    _watchMs = next.timer;
    _watchAt = next.isTurnActive ? DateTime.now() : null;
    // A turn left running when this phone closed can't continue unseen.
    if (next.roleOf(me) == Role.explainer && next.isTurnActive && !ticking && next.phase == TurnPhase.live) {
      next.isTurnActive = false;
      _report(next.timer, turnActive: false);
    }
  }

  void _enter(Stage s) {
    if (stage == s) return;
    stage = s;
    _poll?.cancel();
    if (s == Stage.lobby) {
      _poll = Timer.periodic(lobbyPoll, (_) async {
        // Backstop for a missed start_game event.
        try {
          if (await api.hasGameStarted(gameId)) refresh();
        } on ApiException {
          // Next poll or event will catch up.
        }
      });
    } else if (s == Stage.game) {
      _poll = Timer.periodic(gamePoll, (_) {
        if (!ticking) refresh();
      });
      _ticker ??= Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
    } else {
      _stopClock();
    }
  }

  Future<void> _gone(String why) async {
    _stopClock();
    _poll?.cancel();
    await store.clear();
    stage = Stage.gone;
    _say(why, kind: NoticeKind.error);
    _notify();
  }

  // ── Events ──

  void _onEvent(GameEvent e) {
    final s = state;
    if (e is! TimerUpdate) _eventSeq++;
    switch (e) {
      case PlayerJoined(:final name):
        if (!players.contains(name)) players = [...players, name];
        _say('$name joined', kind: NoticeKind.success, icon: 'person_add');
      case PlayerLeft(:final name):
        players = [...players]..remove(name);
        wordCounts.remove(name);
      case PlayerKicked(:final name):
        if (name == me) {
          _gone('$host removed you from game $gameId');
          return;
        }
        players = [...players]..remove(name);
        wordCounts.remove(name);
      case WordAdded(:final name):
        if (name != me) wordCounts[name] = (wordCounts[name] ?? 0) + 1;
      case WordRemoved(:final name):
        if (name != me) wordCounts[name] = ((wordCounts[name] ?? 1) - 1).clamp(0, 1 << 20);
      case GameStarted():
        refresh();
      case TimerUpdate(:final millis):
        if (s != null && s.roleOf(me) != Role.explainer) {
          s.timer = millis;
          _watchMs = millis;
          _watchAt = DateTime.now();
          _staleChecked = false;
          s.isTurnActive = millis > 0;
        }
      case WordGuessed(:final word):
        if (s != null && s.roleOf(me) != Role.explainer) {
          s.applyGuess(word);
          turnGuesses = [...turnGuesses, word];
        }
      case GuessUndone(:final word):
        if (s != null && s.roleOf(me) != Role.explainer) {
          s.applyUndo(word);
          turnGuesses = [...turnGuesses]..remove(word);
        }
      case OutOfWords():
        if (s != null && s.roleOf(me) != Role.explainer) refresh();
      case NextTurn():
        turnGuesses = [];
        refresh().then((_) {
          if (state?.turnPlayer == me) _say('Your turn to explain!', icon: 'campaign');
        });
      case NextRound():
        refresh().then((_) {
          final st = state;
          if (st != null) _say('Round ${st.round}: ${st.roundKind.title}', icon: 'skip_next');
        });
    }
    _notify();
  }

  // ── Clock ──

  /// Milliseconds to show. Watchers interpolate between the explainer's
  /// once-a-second reports and freeze if they stop (paused or disconnected).
  int get displayMs {
    final s = state;
    if (s == null) return 0;
    if (s.roleOf(me) == Role.explainer || _watchAt == null || !s.isTurnActive) return s.timer;
    final since = DateTime.now().difference(_watchAt!).inMilliseconds;
    return (_watchMs - since.clamp(0, 1500)).clamp(0, _watchMs);
  }

  void _tick() {
    final s = state;
    if (s == null) return;
    if (ticking) {
      final ms = _clockStartMs - _clock.elapsedMilliseconds;
      s.timer = ms < 0 ? 0 : ms;
      if (ms <= 0) {
        _stopClock();
        s.isTurnActive = false;
        _report(0, turnActive: false);
        if (!_alarms.isClosed) _alarms.add(true);
      } else if (_clock.elapsedMilliseconds - _lastReportAt >= clockReport.inMilliseconds) {
        _lastReportAt = _clock.elapsedMilliseconds;
        _report(ms, turnActive: true);
      }
      _notify();
    } else if (s.isTurnActive && s.roleOf(me) != Role.explainer) {
      // Reports stopped: the explainer paused or dropped. Ask the server once.
      final at = _watchAt;
      if (at != null && !_staleChecked && DateTime.now().difference(at).inMilliseconds > 2500) {
        _staleChecked = true;
        refresh();
      }
      _notify(); // smooth countdown
    }
  }

  void _startClock(int fromMs) {
    _clockStartMs = fromMs;
    _lastReportAt = 0;
    _clock
      ..reset()
      ..start();
    _ticker ??= Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
  }

  /// Brings the state up to the stopwatch (the UI tick is only every 100ms).
  void _syncClock() {
    final s = state;
    if (s == null || !ticking) return;
    final ms = _clockStartMs - _clock.elapsedMilliseconds;
    s.timer = ms < 0 ? 0 : ms;
  }

  void _stopClock() {
    _syncClock();
    _clock.stop();
    if (stage != Stage.game) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  Future<void> _reports = Future.value();

  /// Reports go out strictly in order: an older "running" report landing after
  /// a pause, time-up or round-over report would undo it on the server.
  Future<void> _report(int ms, {required bool turnActive, bool roundActive = true}) {
    final s = state;
    if (s == null) return _reports;
    final round = s.round;
    return _reports = _reports.then((_) async {
      try {
        await api.updateTimer(gameId, millis: ms, turnActive: turnActive, roundActive: roundActive, round: round);
      } on ApiException {
        // The next report carries the time; a dropped one only delays watchers.
      }
    });
  }

  // ── Lobby actions ──

  Future<String?> addWord(String raw) async {
    final v = validateWord(raw, myWords);
    if (!v.ok) return v.error;
    if (myWords.length >= wordLimit) return "You can't add more words";
    String? error;
    await _run(() async {
      try {
        await api.addWord(gameId, me, v.value!);
        myWords = [...myWords, v.value!];
      } on ApiException catch (e) {
        if (e.isAuth || e.isNetwork) rethrow;
        error = e.friendly;
      }
    });
    return error;
  }

  Future<void> deleteWord(String word) => _run(() async {
        await api.deleteWord(gameId, me, word);
        myWords = [...myWords]..remove(word);
      });

  Future<void> kick(String player) => _run(() async {
        await api.kickPlayer(gameId, me, player);
        players = [...players]..remove(player);
        wordCounts.remove(player);
        _say('$player was removed', icon: 'person_remove');
      });

  Future<bool> leave() async {
    final ok = await _run(() async {
      await api.leaveGame(gameId, me);
      return true;
    });
    if (ok == true) {
      await store.clear();
      stage = Stage.gone;
      _notify();
    }
    return ok == true;
  }

  Future<void> start() => _run(() async {
        await api.startGame(gameId);
        await refresh();
      });

  LobbyStatus get lobby => lobbyStatus(
        players: players,
        host: host,
        wordCounts: {...wordCounts, me: myWords.length},
        limit: wordLimit,
      );

  // ── Explainer actions ──

  Future<void> startTurn() => _run(() async {
        final s = state!;
        s.isTurnActive = true;
        _startClock(s.timer);
        _report(s.timer, turnActive: true);
        if (s.wordsInPlay.isEmpty) await _draw();
      });

  void pauseTurn() {
    final s = state;
    if (s == null || !ticking) return;
    _stopClock();
    s.isTurnActive = false;
    _report(s.timer, turnActive: false);
    _notify();
  }

  void resumeTurn() {
    final s = state;
    if (s == null || ticking || s.timer <= 0) return;
    s.isTurnActive = true;
    _startClock(s.timer);
    _report(s.timer, turnActive: true);
    _notify();
  }

  Future<void> gotIt(String word) => _run(() async {
        final s = state!;
        if (!ticking) return;
        await api.guessWord(gameId, me, word);
        s.applyGuess(word);
        turnGuesses = [...turnGuesses, word];
        if (s.wordsInPlay.isEmpty) await _draw();
      });

  Future<void> drawWord() => _run(_draw);

  Future<void> _draw() async {
    final s = state!;
    try {
      final word = await api.fetchWord(gameId, me);
      s.wordsToGuess.remove(word);
      if (!s.wordsInPlay.contains(word)) s.wordsInPlay.add(word);
    } on ApiException catch (e) {
      if (e.status == 400 && e.message == 'No words left' && s.wordsInPlay.isEmpty) {
        // The hat is empty: the round is over. Keep the remaining time.
        _stopClock();
        s.wordsToGuess.clear();
        s.isTurnActive = false;
        s.isRoundActive = false;
        // next_round keeps this time for the explainer, so it must land first.
        await _report(s.timer, turnActive: false, roundActive: false);
        await refresh();
      } else if (e.status != 400) {
        rethrow;
      }
    }
  }

  Future<void> undo() => _run(() async {
        final word = await api.undoGuess(gameId, me);
        state!.applyUndo(word);
        final i = turnGuesses.lastIndexOf(word);
        turnGuesses = [...turnGuesses]..removeAt(i < 0 ? turnGuesses.length - 1 : i);
      });

  Future<void> passTurn() => _run(() async {
        if (!_alarms.isClosed) _alarms.add(false);
        await api.nextTurn(gameId);
        turnGuesses = [];
        await refresh();
      });

  Future<void> nextRound() => _run(() async {
        await api.nextRound(gameId);
        await refresh();
      });

  void stopAlarm() {
    if (!_alarms.isClosed) _alarms.add(false);
  }

  void dismissTeamReveal() {
    showTeamReveal = false;
    _notify();
  }

  void showResults() {
    _enter(Stage.results);
    _notify();
  }
}
