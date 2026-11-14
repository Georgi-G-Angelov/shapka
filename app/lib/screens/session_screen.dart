import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../api/events.dart';
import '../app_state.dart';
import '../game/game_controller.dart';
import '../services/alarm.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'create_screen.dart';
import 'game_screen.dart';
import 'home_screen.dart';
import 'lobby_screen.dart';
import 'results_screen.dart';

/// Hosts one joined game: picks the screen for its stage, surfaces notices,
/// rings the alarm, keeps the screen awake in game and refreshes on resume.
class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key, required this.game, this.alarm, this.keepAwake = true});
  final GameController game;
  final Alarm? alarm;
  final bool keepAwake;

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> with WidgetsBindingObserver {
  late final Alarm _alarm = widget.alarm ?? AudioAlarm();
  final _subs = <StreamSubscription<Object?>>[];
  Stage? _awakeFor;

  GameController get game => widget.game;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _subs.add(game.notices.listen((n) {
      if (!mounted) return;
      context.toast(n.text, kind: n.kind, icon: _icons[n.icon]);
    }));
    _subs.add(game.alarms.listen((on) {
      if (on) {
        HapticFeedback.heavyImpact();
        _alarm.ring();
      } else {
        _alarm.stop();
      }
    }));
    game.addListener(_onChange);
  }

  static const _icons = {
    'person_add': Icons.person_add_rounded,
    'person_remove': Icons.person_remove_rounded,
    'campaign': Icons.campaign_rounded,
    'skip_next': Icons.skip_next_rounded,
  };

  void _onChange() {
    if (game.stage == Stage.gone) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) AppScope.read(context).goHome(forget: true);
      });
    }
    if (widget.keepAwake && _awakeFor != game.stage) {
      _awakeFor = game.stage;
      // The explainer's phone lies on the table between turns.
      WakelockPlus.toggle(enable: game.stage == Stage.game).catchError((Object _) {});
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) game.resumed();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    game.removeListener(_onChange);
    for (final s in _subs) {
      s.cancel();
    }
    _alarm.dispose();
    if (widget.keepAwake) WakelockPlus.disable().catchError((Object _) {});
    super.dispose();
  }

  Future<void> _home() => AppScope.read(context).goHome();

  Future<void> _playAgain() async {
    final app = AppScope.read(context);
    final navigator = Navigator.of(context);
    await app.goHome(forget: true);
    navigator.push(fadeRoute(const CreateScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: game,
      builder: (context, _) {
        final p = Palette.of(context);
        final Widget screen = switch (game.stage) {
          Stage.lobby => LobbyScreen(game: game),
          Stage.game when game.showTeamReveal => TeamReveal(game: game),
          Stage.game => GameScreen(game: game, onHome: _home),
          Stage.results => ResultsScreen(game: game, onHome: () => AppScope.read(context).goHome(forget: true), onPlayAgain: _playAgain),
          Stage.loading || Stage.gone => _Loading(error: game.loadError, onRetry: game.refresh, onHome: _home),
        };
        final key = switch (game.stage) {
          Stage.game when game.showTeamReveal => 'reveal',
          final s => s.name,
        };
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _home();
          },
          child: Stack(children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 340),
              child: KeyedSubtree(key: ValueKey(key), child: screen),
            ),
            ReconnectingPill(visible: game.stage != Stage.loading && game.connection == StreamStatus.reconnecting),
            if (game.stage == Stage.loading) Container(color: p.bg.withValues(alpha: 0)),
          ]),
        );
      },
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading({required this.error, required this.onRetry, required this.onHome});
  final String? error;
  final Future<void> Function() onRetry;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: error == null
                ? CircularProgressIndicator(color: p.primary)
                : Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.wifi_off_rounded, size: 40, color: p.text3),
                    const SizedBox(height: 12),
                    Text(error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 16, color: p.text2)),
                    const SizedBox(height: 20),
                    AppButton(label: 'Try again', onPressed: onRetry),
                    const SizedBox(height: 8),
                    TextAction(label: 'Back to home', onPressed: onHome),
                  ]),
          ),
        ),
      ),
    );
  }
}
