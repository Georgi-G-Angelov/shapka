import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Colours from design/project/shapka-app.jsx (PALETTES). The purple is the
/// web client's #9C27B0 → #7B1FA2 gradient.
class AppPalette {
  const AppPalette({
    required this.isDark,
    required this.primary,
    required this.primaryDeep,
    required this.primaryLight,
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.border,
    required this.text,
    required this.text2,
    required this.text3,
    required this.success,
    required this.danger,
    required this.warning,
    required this.stage,
    required this.stage2,
    required this.cardShadow,
  });

  final bool isDark;
  final Color primary;
  final Color primaryDeep;
  final Color primaryLight;
  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color border;
  final Color text;
  final Color text2;
  final Color text3;
  final Color success;
  final Color danger;
  final Color warning;

  /// The immersive game background (home, team reveal, every in-game screen).
  final Color stage;
  final Color stage2;
  final Color cardShadow;

  static const gold = Color(0xFFE2A915);
  static const silver = Color(0xFF98A2AB);
  static const bronze = Color(0xFFC9733A);
  static const onStageAccent = Color(0xFFE1BEE7);
  static const urgent = Color(0xFFFF4D6A);
  static const highlight = Color(0xFFFDE68A);
  static const gotIt = [Color(0xFF1DB954), Color(0xFF0E8A3C)];

  LinearGradient get primaryGradient =>
      LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [primary, primaryDeep]);

  RadialGradient stageGradient({bool urgent = false}) => RadialGradient(
        center: const Alignment(0, -0.4),
        radius: 1.2,
        colors: [urgent ? const Color(0xFF6B1236) : stage2, stage],
        stops: const [0, 0.75],
      );
}

const kLightPalette = AppPalette(
  isDark: false,
  primary: Color(0xFF8E24AA),
  primaryDeep: Color(0xFF6A1B9A),
  primaryLight: Color(0xFFF3E5F7),
  bg: Color(0xFFF6F1F8),
  surface: Color(0xFFFFFFFF),
  surfaceAlt: Color(0xFFEEE6F2),
  border: Color(0xFFE2D6E8),
  text: Color(0xFF1C1022),
  text2: Color(0xFF4B3D53),
  text3: Color(0xFF877A8F),
  success: Color(0xFF11883F),
  danger: Color(0xFFC62842),
  warning: Color(0xFFE07B00),
  stage: Color(0xFF3A0D48),
  stage2: Color(0xFF8E24AA),
  cardShadow: Color(0x594A1559),
);

const kDarkPalette = AppPalette(
  isDark: true,
  primary: Color(0xFFB04CC8),
  primaryDeep: Color(0xFF7B1FA2),
  primaryLight: Color(0xFF36203F),
  bg: Color(0xFF130A17),
  surface: Color(0xFF20152A),
  surfaceAlt: Color(0xFF2B1F35),
  border: Color(0xFF3B2D45),
  text: Color(0xFFF7EEF9),
  text2: Color(0xFFCDBFD4),
  text3: Color(0xFF94879C),
  success: Color(0xFF34D17A),
  danger: Color(0xFFFF5C73),
  warning: Color(0xFFFFB347),
  stage: Color(0xFF14061A),
  stage2: Color(0xFF4A1559),
  cardShadow: Color(0xB3000000),
);

/// Ten team colours (20 players max → 10 teams), readable on light and dark.
const teamColors = [
  Color(0xFF8E24AA), Color(0xFFE65100), Color(0xFF00897B), Color(0xFF1E88E5), Color(0xFFD81B60),
  Color(0xFF7CB342), Color(0xFF5E35B1), Color(0xFFF4A100), Color(0xFF00ACC1), Color(0xFF6D4C41),
];

Color teamColor(int index) => teamColors[index % teamColors.length];

/// Before teams exist a player's colour comes from their name.
Color nameColor(String name) {
  var h = 0;
  for (final r in name.runes) {
    h = (h * 31 + r) & 0xFFFFFFFF;
  }
  return teamColors[h % teamColors.length];
}

/// Makes the palette available below MaterialApp: `Palette.of(context)`.
class Palette extends InheritedWidget {
  const Palette({super.key, required this.palette, required super.child});
  final AppPalette palette;

  static AppPalette of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<Palette>()?.palette ?? kLightPalette;

  @override
  bool updateShouldNotify(Palette oldWidget) => oldWidget.palette != palette;
}

ThemeData buildTheme(AppPalette p) => ThemeData(
      useMaterial3: true,
      brightness: p.isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: p.bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: p.primary,
        brightness: p.isDark ? Brightness.dark : Brightness.light,
        primary: p.primary,
        surface: p.surface,
        error: p.danger,
      ),
      textSelectionTheme: TextSelectionThemeData(cursorColor: p.primary, selectionHandleColor: p.primary),
      splashFactory: NoSplash.splashFactory,
    );

enum AppThemeMode { system, light, dark }

class ThemeController extends ChangeNotifier {
  AppThemeMode mode = AppThemeMode.system;
  static const _key = 'shapka_theme_mode';

  Future<void> load() async {
    final saved = (await SharedPreferences.getInstance()).getString(_key);
    mode = AppThemeMode.values.firstWhere((m) => m.name == saved, orElse: () => AppThemeMode.system);
    notifyListeners();
  }

  bool isDark(Brightness platform) =>
      mode == AppThemeMode.dark || (mode == AppThemeMode.system && platform == Brightness.dark);

  /// The home screen's moon/sun button flips to an explicit light or dark mode.
  Future<void> toggle(Brightness platform) async {
    mode = isDark(platform) ? AppThemeMode.light : AppThemeMode.dark;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setString(_key, mode.name);
  }
}
