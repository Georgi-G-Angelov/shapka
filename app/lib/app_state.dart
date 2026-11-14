import 'package:flutter/material.dart';

import 'api/shapka_api.dart';
import 'game/game_controller.dart';
import 'game/rules.dart';
import 'session/session_store.dart';
import 'theme.dart';
import 'widgets/common.dart';

/// What the home screen's "still going" card shows.
class ResumeInfo {
  const ResumeInfo({required this.session, required this.detail});
  final SavedSession session;
  final String detail;
}

/// App-wide state: theme, toasts, the remembered name and the joined game.
class AppState extends ChangeNotifier {
  AppState({SessionStore? store, ShapkaApi Function()? apiFactory, this.controllerFactory})
      : store = store ?? SessionStore(),
        apiFactory = apiFactory ?? ShapkaApi.new;

  final SessionStore store;
  final ShapkaApi Function() apiFactory;
  final GameController Function(ShapkaApi api, SavedSession session, SessionStore store)? controllerFactory;
  final theme = ThemeController();
  final toasts = Toasts();

  String savedName = '';
  ResumeInfo? resume;

  /// The game on screen; null on Home, Create and Join.
  GameController? game;

  Future<void> init() async {
    await theme.load();
    savedName = await store.lastName() ?? '';
    await checkResume();
    notifyListeners();
  }

  /// Is the saved game still going? (Replaces the web client's checkActiveGameExists.)
  Future<void> checkResume() async {
    final saved = await store.load();
    if (saved == null) {
      resume = null;
      notifyListeners();
      return;
    }
    final api = apiFactory()..token = saved.token;
    try {
      final state = await api.fetchGameState(saved.gameId);
      final players = await api.fetchPlayers(saved.gameId);
      if (!players.players.contains(saved.name)) throw ApiException(403, 'Not in game');
      final detail = state.isGameFinished
          ? 'Game over · see the results'
          : !state.hasGameStarted
              ? 'Lobby · ${players.players.length} ${players.players.length == 1 ? 'player' : 'players'}'
              : 'Round ${state.round} · ${state.turnPlayer == saved.name ? 'your turn' : '${state.turnPlayer} is explaining'}';
      resume = ResumeInfo(session: saved, detail: detail);
    } on ApiException catch (e) {
      // Keep the session through network trouble; forget it if the game is gone.
      if (e.isNetwork || e.isRateLimited) {
        resume = ResumeInfo(session: saved, detail: "Tap to reconnect");
      } else {
        resume = null;
        await store.clear();
      }
    } finally {
      api.close();
    }
    notifyListeners();
  }

  Future<void> _enter(ShapkaApi api, SavedSession session) async {
    await store.save(session);
    savedName = session.name;
    resume = null;
    await _closeGame();
    final controller = controllerFactory?.call(api, session, store) ?? GameController(api: api, session: session, store: store);
    game = controller;
    notifyListeners();
    await controller.open();
  }

  /// `GET /create_game/<name>/<limit>/<turn_seconds>/<rounds>`
  Future<void> create({required String name, required int wordLimit, required int turnSeconds, required List<int> rounds}) async {
    final api = apiFactory();
    final m = await api.createGame(name: name, wordLimit: wordLimit, turnSeconds: turnSeconds, rounds: rounds);
    await _enter(api, SavedSession(gameId: m.gameId, name: m.name, token: m.token));
  }

  /// `GET /join_game/<id>/<name>`. Throws [ApiException] for the form to show.
  Future<void> join({required int gameId, required String name}) async {
    final api = apiFactory();
    final m = await api.joinGame(gameId: gameId, name: name);
    await _enter(api, SavedSession(gameId: m.gameId, name: m.name, token: m.token));
  }

  Future<void> resumeGame() async {
    final r = resume;
    if (r == null) return;
    await _enter(apiFactory()..token = r.session.token, r.session);
  }

  /// Back to Home without leaving: the game keeps going and can be rejoined.
  Future<void> goHome({bool forget = false}) async {
    await _closeGame();
    if (forget) await store.clear();
    await checkResume();
  }

  Future<void> _closeGame() async {
    final g = game;
    game = null;
    notifyListeners();
    if (g != null) {
      g.api.close();
      g.dispose();
    }
  }

  @override
  void dispose() {
    game?.dispose();
    theme.dispose();
    toasts.dispose();
    super.dispose();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

/// Toast helper for screens.
extension Toast on BuildContext {
  void toast(String text, {IconData? icon, NoticeKind kind = NoticeKind.info}) {
    final p = Palette.of(this);
    AppScope.read(this).toasts.show(ToastMessage(
          text,
          icon: icon ?? (kind == NoticeKind.error ? Icons.error_outline_rounded : null),
          color: switch (kind) { NoticeKind.error => p.danger, NoticeKind.success => p.success, NoticeKind.info => p.primary },
        ));
  }
}

/// A short human summary of the settings, e.g. "45s turns · Describe, Act it out".
String settingsSummary(int turnSeconds, List<int> rounds) => '${turnSeconds}s turns · ${rounds.length == RoundKind.all.length ? 'all 3 rounds' : rounds.map((r) => RoundKind.of(r).title).join(', ')}';
