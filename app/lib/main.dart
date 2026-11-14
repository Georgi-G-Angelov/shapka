import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_state.dart';
import 'game/game_controller.dart';
import 'screens/home_screen.dart';
import 'screens/session_screen.dart';
import 'theme.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  final app = AppState();
  await app.init();
  runApp(ShapkaApp(state: app));
}

class ShapkaApp extends StatelessWidget {
  const ShapkaApp({super.key, required this.state, this.sessionBuilder});
  final AppState state;

  /// Tests swap in a session screen without sound or wakelock.
  final Widget Function(AppState state)? sessionBuilder;

  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: ListenableBuilder(
          listenable: state.theme,
          builder: (context, _) {
            final dark = state.theme.isDark(MediaQuery.platformBrightnessOf(context));
            final palette = dark ? kDarkPalette : kLightPalette;
            return Palette(
              palette: palette,
              child: MaterialApp(
                title: 'Shapka',
                debugShowCheckedModeBanner: false,
                theme: buildTheme(palette),
                builder: (context, child) => Palette(
                  palette: palette,
                  child: Stack(children: [child!, ToastLayer(toasts: state.toasts)]),
                ),
                home: _Root(sessionBuilder: sessionBuilder),
              ),
            );
          },
        ),
      );
}

/// Home, or the joined game.
class _Root extends StatelessWidget {
  const _Root({this.sessionBuilder});
  final Widget Function(AppState state)? sessionBuilder;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final game = app.game;
    final immersive = game == null || game.stage == Stage.game;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: immersive || Palette.of(context).isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 340),
        child: game == null
            ? const HomeScreen(key: ValueKey('home'))
            : KeyedSubtree(
                key: ObjectKey(game),
                child: sessionBuilder?.call(app) ?? SessionScreen(game: game),
              ),
      ),
    );
  }
}
