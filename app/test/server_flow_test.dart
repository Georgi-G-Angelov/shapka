// End-to-end: four players' controllers against a real server.
//
//   cargo run   (in the repo root, serves on :8000)
//   SHAPKA_TEST_SERVER=http://127.0.0.1:8000 flutter test test/server_flow_test.dart
//
// Skipped when SHAPKA_TEST_SERVER is unset.
@Timeout(Duration(minutes: 3))
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shapka/api/shapka_api.dart';
import 'package:shapka/game/game_controller.dart';
import 'package:shapka/game/rules.dart';
import 'package:shapka/session/session_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MemoryStore extends SessionStore {
  SavedSession? saved;
  @override
  Future<SavedSession?> load() async => saved;
  @override
  Future<void> save(SavedSession session) async => saved = session;
  @override
  Future<void> clear() async => saved = null;
  @override
  Future<String?> lastName() async => null;
  @override
  Future<void> saveName(String name) async {}
}

Future<void> until(String what, bool Function() condition, {Duration timeout = const Duration(seconds: 10)}) async {
  final end = DateTime.now().add(timeout);
  while (!condition()) {
    if (DateTime.now().isAfter(end)) fail('Timed out waiting for: $what');
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
}

void main() {
  final server = Platform.environment['SHAPKA_TEST_SERVER'];

  test('a full game: lobby, kick, turns, undo, pause, time up, rounds, results', () async {
    SharedPreferences.setMockInitialValues({});
    final controllers = <String, GameController>{};
    final notices = <String, List<Notice>>{};
    final alarms = <String, List<bool>>{};

    Future<GameController> open(Membership m, ShapkaApi api) async {
      final c = GameController(api: api, session: SavedSession(gameId: m.gameId, name: m.name, token: m.token), store: MemoryStore());
      controllers[m.name] = c;
      c.notices.listen((n) => (notices[m.name] ??= []).add(n));
      c.alarms.listen((a) => (alarms[m.name] ??= []).add(a));
      await c.open();
      return c;
    }

    addTearDown(() {
      for (final c in controllers.values) {
        c.dispose();
        c.api.close();
      }
    });

    // Lobby
    final hostApi = ShapkaApi(baseUrl: server);
    final created = await hostApi.createGame(name: 'Ана', wordLimit: 4, turnSeconds: 30, rounds: [1, 3]);
    final host = await open(created, hostApi);
    expect(host.stage, Stage.lobby);
    expect(host.isHost, isTrue);

    for (final name in ['bobi', 'cveti', 'dimo', 'eli']) {
      final api = ShapkaApi(baseUrl: server);
      await open(await api.joinGame(gameId: created.gameId, name: name), api);
    }
    await until('host sees everyone join (${host.players} ${host.connection})', () => host.players.length == 5);
    expect(notices['Ана']!.map((n) => n.text), contains('bobi joined'));

    await host.kick('eli');
    await until('eli is told and leaves', () => controllers['eli']!.stage == Stage.gone);
    controllers.remove('eli')!
      ..dispose()
      ..api.close();
    await until('everyone sees eli go', () => controllers.values.every((c) => c.players.length == 4));

    expect(await controllers['bobi']!.addWord('two words'), 'One word only, without spaces or punctuation');
    var n = 0;
    for (final c in controllers.values) {
      for (var i = 0; i < 4; i++) {
        expect(await c.addWord('слово${String.fromCharCode(97 + n++)}'), isNull);
      }
    }
    await until('host can start', () => host.lobby.canStart);
    expect(host.lobby.totalWords, 16);
    await controllers['dimo']!.deleteWord(controllers['dimo']!.myWords.first);
    await until('host sees the removed word', () => !host.lobby.canStart);
    expect(await controllers['dimo']!.addWord('replacement'), isNull);
    await until('host can start again', () => host.lobby.canStart);

    await host.start();
    await until('everyone is in the game', () => controllers.values.every((c) => c.stage == Stage.game && c.state != null));
    expect(controllers.values.every((c) => c.showTeamReveal), isTrue);
    final s0 = host.state!;
    expect(s0.turnLength, 30000);
    expect(s0.rounds, [1, 3]);

    GameController explainer() => controllers[controllers.values.first.state!.turnPlayer]!;
    List<GameController> watchers() => [for (final c in controllers.values) if (c != explainer()) c];

    // Turn 1: start, guess two, undo one, pause, resume, run out of time.
    final ex = explainer();
    expect(ex.state!.phase, TurnPhase.ready);
    await ex.startTurn();
    expect(ex.state!.phase, TurnPhase.live);
    expect(ex.state!.wordsInPlay, hasLength(1));
    await until('watchers see the clock running', () => watchers().every((w) => w.state!.phase == TurnPhase.live));
    await ex.gotIt(ex.state!.wordsInPlay.first);
    await ex.drawWord();
    expect(ex.state!.wordsInPlay, hasLength(2));
    await ex.gotIt(ex.state!.wordsInPlay.first);
    await until('watchers count two guesses', () => watchers().every((w) => w.turnGuesses.length == 2));
    await ex.undo();
    expect(ex.turnGuesses, hasLength(1));
    await until('watchers see the undo', () => watchers().every((w) => w.turnGuesses.length == 1 && teamTotal(w.state!, w.state!.teamOf(ex.me)!) == 1));

    ex.pauseTurn();
    expect(ex.state!.phase, TurnPhase.paused);
    await until('watchers notice the pause', () => watchers().every((w) => w.state!.phase == TurnPhase.paused), timeout: const Duration(seconds: 8));
    ex.resumeTurn();
    await until('time runs out', () => ex.state!.phase == TurnPhase.timesUp, timeout: const Duration(seconds: 40));
    expect(alarms[ex.me], [true]);
    await until('watchers see time is up', () => watchers().every((w) => w.state!.phase == TurnPhase.timesUp));

    final nextUp = ex.state!.upNext!.explainer;
    await ex.passTurn();
    expect(alarms[ex.me], [true, false]);
    await until('the turn passes for everyone', () => controllers.values.every((c) => c.state!.turnPlayer == nextUp && c.turnGuesses.isEmpty));
    expect(controllers[nextUp]!.state!.timer, 30000);
    expect(notices[nextUp]!.map((n) => n.text), contains('Your turn to explain!'));

    // Turn 2: empty the hat.
    Future<void> playOutRound() async {
      final e = explainer();
      await e.startTurn();
      while (e.state!.phase == TurnPhase.live) {
        await e.gotIt(e.state!.wordsInPlay.first);
      }
    }

    await playOutRound();
    expect(explainer().state!.phase, TurnPhase.roundOver);
    await until('everyone sees the round end', () => controllers.values.every((c) => c.state!.phase == TurnPhase.roundOver));
    expect(controllers.values.every((c) => c.state!.wordsLeft == 0), isTrue);

    // Round 2 of 2 (Act it out): the same explainer carries on with their time.
    final keeper = explainer();
    await keeper.nextRound();
    await until('round 2 for everyone', () => controllers.values.every((c) => c.state!.round == 2 && c.state!.phase == TurnPhase.ready));
    expect(explainer(), same(keeper));
    expect(keeper.state!.roundKind.title, 'Act it out');
    expect(keeper.state!.timer, lessThan(30000));
    expect(controllers.values.every((c) => c.turnGuesses.isEmpty), isTrue, reason: '"this turn" restarts with the round');

    await playOutRound();
    await until('the game is over for everyone', () => controllers.values.every((c) => c.state!.phase == TurnPhase.gameOver));
    final table = standings(host.state!);
    expect(table.fold<int>(0, (n, r) => n + r.total), 32, reason: 'the undone word went back in the hat; every word is guessed in both rounds');
    host.showResults();
    expect(host.stage, Stage.results);
  }, skip: server == null ? 'Set SHAPKA_TEST_SERVER to run against a real server' : false);
}
