import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shapka/app_state.dart';
import 'package:shapka/session/session_store.dart';
import 'package:shapka/main.dart';
import 'package:shapka/services/alarm.dart';
import 'package:shapka/screens/session_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fakes.dart';

class SilentAlarm implements Alarm {
  int rings = 0;
  @override
  void ring() => rings++;
  @override
  void stop() {}
  @override
  void dispose() {}
}

Future<AppState> launch(WidgetTester tester, FakeServer server, {SilentAlarm? alarm, MemoryStore? store}) async {
  SharedPreferences.setMockInitialValues({});
  await tester.binding.setSurfaceSize(const Size(390, 844));
  final app = fakeApp(server, store: store);
  await tester.runAsync(app.init);
  await tester.pumpWidget(ShapkaApp(
    state: app,
    sessionBuilder: (s) => SessionScreen(game: s.game!, alarm: alarm ?? SilentAlarm(), keepAwake: false),
  ));
  await tester.pump();
  return app;
}

/// Unmounts and disposes everything so no timers outlive the test.
Future<void> done(WidgetTester tester, AppState app) async {
  await tester.pumpWidget(const SizedBox());
  app.dispose();
  await tester.pump(const Duration(seconds: 3));
  await tester.binding.setSurfaceSize(null);
}

Future<void> tapText(WidgetTester tester, String text, {bool last = false}) async {
  final finder = last ? find.text(text).last : find.text(text);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
}

/// Lets fake HTTP futures complete, then settles animations.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 400));
  }
}

void main() {
  testWidgets('home offers Create and Join', (tester) async {
    final app = await launch(tester, FakeServer());
    expect(find.text('Create'), findsOneWidget);
    expect(find.text('Join'), findsOneWidget);
    expect(find.textContaining('still going'), findsNothing);
    await done(tester, app);
  });

  testWidgets('create sends the advanced settings and opens the lobby as host', (tester) async {
    final server = FakeServer();
    final app = await launch(tester, server);
    await tester.tap(find.text('Create'));
    await settle(tester);

    expect(find.text('60s turns · all 3 rounds'), findsOneWidget);
    await tester.tap(find.text('Advanced'));
    await settle(tester);
    await tapText(tester, '45s');
    await tapText(tester, 'One word');
    await tester.pump();
    expect(find.text('45s turns · Describe, Act it out'), findsOneWidget);
    await tapText(tester, 'Describe');
    await tapText(tester, 'Act it out');
    await tester.pump();
    expect(find.text('45s turns · Act it out'), findsOneWidget, reason: 'the last round cannot be unticked');

    await tester.enterText(find.byType(TextField).first, 'Maya');
    await tapText(tester, 'Create game');
    await settle(tester);
    expect(server.requests.first.path, '/create_game/Maya/5/45/3');
    expect(find.text('Your game'), findsOneWidget);
    expect(find.text('4821'), findsOneWidget);
    expect(find.text('Invite at least one more player'), findsOneWidget);
    await done(tester, app);
  });

  testWidgets('join puts server errors on the field they concern', (tester) async {
    final server = FakeServer(players: ['Ani', 'Bobi'], host: 'Ani')..joinError = 'Name already exists';
    final app = await launch(tester, server);
    await tester.tap(find.text('Join'));
    await settle(tester);
    await tester.enterText(find.byType(TextField).at(0), '4821');
    await tester.enterText(find.byType(TextField).at(1), 'Bobi');
    await tapText(tester, 'Join game', last: true);
    await settle(tester);
    expect(find.text('Someone in this game is already called Bobi. Add an initial?'), findsOneWidget);

    server.joinError = 'Game not found';
    await tapText(tester, 'Join game', last: true);
    await settle(tester);
    expect(find.text("There's no game 4821. Check the code with the host."), findsOneWidget);

    server.joinError = null;
    await tester.enterText(find.byType(TextField).at(1), 'Maya');
    await tapText(tester, 'Join game', last: true);
    await settle(tester);
    expect(find.text("Ani's game"), findsOneWidget);
    expect(find.text('Waiting for Ani to start'), findsOneWidget);
    await done(tester, app);
  });

  testWidgets('lobby: words are validated, added as chips, then "You\'re all set!"', (tester) async {
    final server = FakeServer(players: ['Ani'], host: 'Ani', limit: 4);
    final app = await launch(tester, server);
    await tester.runAsync(() => app.join(gameId: 4821, name: 'Maya'));
    await settle(tester);

    await tester.enterText(find.byType(TextField), 'two words');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await settle(tester);
    expect(find.text('One word only, without spaces or punctuation'), findsOneWidget);

    for (final w in ['penguin', 'sauna', 'kite', 'yoga']) {
      await tester.enterText(find.byType(TextField), w);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await settle(tester);
    }
    expect(find.text("You're all set!"), findsOneWidget);
    expect(find.text('4/4'), findsOneWidget);
    expect(server.words['Maya'], ['penguin', 'sauna', 'kite', 'yoga']);

    await tester.tap(find.text('sauna'));
    await settle(tester);
    expect(find.text('Add your words'), findsOneWidget);
    expect(server.words['Maya'], ['penguin', 'kite', 'yoga']);
    await done(tester, app);
  });

  testWidgets('explainer: team reveal, start, got it, time up and pass', (tester) async {
    final server = FakeServer()..startGame(turnLength: 30000, rounds: [1, 3]);
    final alarm = SilentAlarm();
    final app = await launch(tester, server, alarm: alarm);
    await tester.runAsync(() => app.join(gameId: 4821, name: 'Maya'));
    await settle(tester);

    // Opened straight into a running game: no reveal (that is shown when the host starts).
    expect(find.text('Your turn, Maya!'), findsOneWidget);
    expect(find.text('Round 1/2 · Describe'), findsOneWidget);
    expect(find.text('Start · 30s'), findsOneWidget);

    await tester.tap(find.text('Start · 30s'));
    await settle(tester);
    expect(find.text('kite'), findsOneWidget);
    await tester.tap(find.text('Got it'));
    await settle(tester);
    expect(server.requests.map((u) => u.path), contains('/guess_word/4821/Maya/kite'));
    expect(find.text('sauna'), findsOneWidget, reason: 'the next word is drawn automatically');
    expect(find.text('Undo “kite”'), findsOneWidget);

    await tester.tap(find.text('Stuck? Draw a second word'));
    await settle(tester);
    expect(find.text('WORD 2'), findsOneWidget);
    expect(find.text('Holding two words'), findsOneWidget);

    // Let the 30 s clock run out.
    for (var i = 0; i < 70; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 500)));
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text("Time's up!").evaluate().isNotEmpty) break;
    }
    expect(find.text("Time's up!"), findsOneWidget);
    expect(alarm.rings, 1);
    expect(find.text('Pass to Ani'), findsOneWidget);
    expect(server.requests.map((u) => u.path), contains('/update_timer_state/4821/0/false/true/1'));
    await done(tester, app);
  }, timeout: const Timeout(Duration(minutes: 2)));

  testWidgets('guesser sees the clock and never the word', (tester) async {
    final server = FakeServer()..startGame(turnPlayer: 'Bobi');
    final app = await launch(tester, server);
    await tester.runAsync(() => app.join(gameId: 4821, name: 'Maya'));
    await settle(tester);
    expect(find.text("You're guessing!"), findsOneWidget);
    expect(find.text('Listen to Bobi'), findsOneWidget);
    expect(find.text('GET READY'), findsOneWidget);
    expect(find.text('kite'), findsNothing);
    expect(find.text('Got it'), findsNothing);
    await done(tester, app);
  });

  testWidgets('a saved game offers to rejoin from home', (tester) async {
    final server = FakeServer()..startGame(turnPlayer: 'Ani');
    final store = MemoryStore();
    await store.save(const SavedSession(gameId: 4821, name: 'Maya', token: 'tok'));
    final app = await launch(tester, server, store: store);
    await settle(tester);
    expect(find.text('Game 4821 is still going'), findsOneWidget);
    expect(find.text('Round 1 · Ani is explaining'), findsOneWidget);
    await tester.tap(find.text('Rejoin'));
    await settle(tester);
    expect(find.text("Other team's turn"), findsOneWidget);
    await done(tester, app);
  });
}
