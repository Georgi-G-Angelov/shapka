// Drives the real app against a real server, with other players simulated
// through the API. Run on a simulator with the server on :8000:
//
//   flutter test integration_test/app_flow_test.dart -d <simulator>
//
// Each `SHOT <name> <epoch ms>` line marks a screen worth a screenshot.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shapka/api/shapka_api.dart';
import 'package:shapka/app_state.dart';
import 'package:shapka/game/rules.dart';
import 'package:shapka/main.dart';
import 'package:shapka/session/session_store.dart';

const pauseMs = int.fromEnvironment('TOUR_PAUSE_MS', defaultValue: 1800);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('create, fill the lobby, play turns and rounds, see results', (tester) async {
    await SessionStore().clear();
    final app = AppState();
    await app.init();
    await tester.pumpWidget(ShapkaApp(state: app));

    Future<void> wait(int ms) async {
      final end = DateTime.now().add(Duration(milliseconds: ms));
      while (DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    Future<void> until(String text, {int seconds = 20}) async {
      final end = DateTime.now().add(Duration(seconds: seconds));
      while (find.textContaining(text).evaluate().isEmpty) {
        if (DateTime.now().isAfter(end)) fail('Never saw "$text"');
        await tester.pump(const Duration(milliseconds: 100));
      }
    }

    Future<void> shot(String name) async {
      await wait(500);
      stdout.writeln('SHOT $name ${DateTime.now().millisecondsSinceEpoch}');
      await wait(pauseMs);
    }

    Future<void> tap(String text) async {
      final f = find.text(text).last;
      await tester.ensureVisible(f);
      await wait(300);
      await tester.tap(f);
      await wait(400);
    }

    String textStarting(String prefix) =>
        find.textContaining(prefix).evaluate().map((e) => (e.widget as Text).data!).firstWhere((t) => t.startsWith(prefix));

    await wait(1500);
    await shot('home');

    // Create: 4 words each, 30s turns, Describe + Act it out.
    await tap('Create');
    await tester.enterText(find.byType(TextField).first, 'Maya');
    await tester.tap(find.bySemanticsLabel('Fewer words'));
    await tap('Advanced');
    await tap('30s');
    await tap('One word');
    FocusManager.instance.primaryFocus?.unfocus();
    await shot('create-advanced');
    await tap('Create game');
    await until('GAME CODE');
    final gameId = app.game!.gameId;

    // Friends join and add their words over the API.
    final friends = <String, ShapkaApi>{};
    for (final name in ['Bobi', 'Ani', 'Dimi']) {
      final api = ShapkaApi();
      await api.joinGame(gameId: gameId, name: name);
      friends[name] = api;
      await wait(500);
    }
    var i = 0;
    for (final e in friends.entries) {
      for (final w in ['kite', 'sauna', 'yoga', 'tango']) {
        await e.value.addWord(gameId, e.key, '$w${'abc'[i]}');
      }
      i++;
      if (i == 1) await shot('lobby-filling');
    }
    Future<void> addWord(String w) async {
      await tester.tap(find.byType(TextField));
      await wait(300);
      await tester.enterText(find.byType(TextField), w);
      await wait(200);
      await tester.tap(find.bySemanticsLabel('Add word'));
      await wait(600);
    }

    for (final w in ['penguin', 'volcano', 'banitsa']) {
      await addWord(w);
    }
    FocusManager.instance.primaryFocus?.unfocus();
    await shot('lobby-one-to-go');
    await addWord('karaoke');
    FocusManager.instance.primaryFocus?.unfocus();
    await until("You're all set!");
    await shot('lobby-ready');

    await tap('Start game · 2 teams');
    await until('Your teammate is');
    await shot('team-reveal');
    await tap("Let's go");

    final host = ShapkaApi()..token = app.game!.session.token;
    Future<GameState> server() => host.fetchGameState(gameId);

    // Another player's whole turn, through the API.
    Future<void> remoteTurn({int guesses = 2, bool emptyHat = false, String? shotName}) async {
      var s = await server();
      final name = s.turnPlayer;
      final api = friends[name]!;
      var ms = s.timer;
      await api.updateTimer(gameId, millis: ms, turnActive: true, roundActive: true, round: s.round);
      var n = 0;
      while (emptyHat || n < guesses) {
        s = await server();
        if (s.wordsInPlay.isEmpty && s.wordsToGuess.isEmpty) break;
        final word = s.wordsInPlay.isNotEmpty ? s.wordsInPlay.first : await api.fetchWord(gameId, name);
        await wait(emptyHat ? 150 : 900);
        await api.guessWord(gameId, name, word);
        n++;
        ms -= 1000;
        await api.updateTimer(gameId, millis: ms, turnActive: true, roundActive: true, round: s.round);
      }
      if (shotName != null) await shot(shotName);
      s = await server();
      if (s.wordsInPlay.isEmpty && s.wordsToGuess.isEmpty) {
        await api.updateTimer(gameId, millis: ms, turnActive: false, roundActive: false, round: s.round);
        return;
      }
      await api.updateTimer(gameId, millis: 0, turnActive: false, roundActive: true, round: s.round);
      await until("Time's up!");
      await shot('watch-times-up');
      await api.nextTurn(gameId);
      await wait(1500);
    }

    // Play until Maya has explained once.
    var myTurnDone = false;
    var watched = 0;
    while (!myTurnDone) {
      final s = await server();
      if (s.turnPlayer == 'Maya') {
        await until('Your turn, Maya!');
        await shot('explainer-ready');
        await tap('Start · 30s');
        await wait(600);
        await tap('Got it');
        await tap('Got it');
        await shot('explainer-live');
        await tap('Stuck? Draw a second word');
        await shot('explainer-two-words');
        await tester.tap(find.bySemanticsLabel('Pause').last);
        await wait(500);
        await shot('explainer-paused');
        await tester.tap(find.bySemanticsLabel('Resume').last);
        await until("Time's up!", seconds: 40);
        await shot('explainer-times-up');
        await tap(textStarting('Pass to'));
        myTurnDone = true;
      } else {
        final role = s.roleOf('Maya');
        await remoteTurn(shotName: role == Role.guesser ? 'guesser' : watched == 0 ? 'other-team' : null);
        watched++;
      }
      await wait(1000);
    }

    Future<void> emptyTheHat() async {
      final s = await server();
      if (s.turnPlayer == 'Maya') {
        await tap(textStarting('Start · '));
        while (find.text('Got it').evaluate().isNotEmpty) {
          await tester.tap(find.text('Got it').first);
          await wait(250);
        }
      } else {
        await remoteTurn(emptyHat: true);
      }
    }

    await emptyTheHat();
    await until('The hat is empty!');
    await shot('round-over');

    final s = await server();
    if (s.turnPlayer == 'Maya') {
      await tap(textStarting('Start round 2'));
    } else {
      await friends[s.turnPlayer]!.nextRound(gameId);
    }
    await until('Round 2/2');
    await shot('round-two');

    await emptyTheHat();
    await until("That's the game!");
    await shot('game-over');
    await tap('See the results');
    await until('Thanks for playing!');
    await shot('results');
    await tester.tap(find.textContaining('(you)').first);
    await wait(600);
    await shot('results-expanded');

    for (final api in friends.values) {
      api.close();
    }
    host.close();
  }, timeout: const Timeout(Duration(minutes: 6)));
}
