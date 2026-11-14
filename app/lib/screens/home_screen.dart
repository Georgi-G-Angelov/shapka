import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'create_screen.dart';
import 'join_screen.dart';
import 'sheets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final p = Palette.of(context);
    final platform = MediaQuery.platformBrightnessOf(context);
    final dark = app.theme.isDark(platform);
    final resume = app.resume;
    return Scaffold(
      backgroundColor: p.stage,
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(center: const Alignment(0, -0.65), radius: 1.1, colors: [p.stage2, p.stage], stops: const [0, 0.7]),
        ),
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                AppIconButton(icon: Icons.help_outline_rounded, label: 'How to play', color: Colors.white70, onPressed: () => showHowToPlay(context)),
                AppIconButton(
                  icon: dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                  label: dark ? 'Light theme' : 'Dark theme',
                  color: Colors.white70,
                  onPressed: () => app.theme.toggle(platform),
                ),
              ]),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(colors: [Color(0x59CE93D8), Color(0x00CE93D8)], stops: [0, 0.65]),
                      ),
                      padding: const EdgeInsets.all(28),
                      child: const HatLogo(size: 168, bob: true),
                    ),
                    Semantics(header: true, label: 'Shapka', child: const ExcludeSemantics(child: Wordmark(size: 64, color: Colors.white))),
                    const SizedBox(height: 10),
                    const Text('Words in a hat. Teams of two. Three rounds of chaos.',
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 16, color: Colors.white70, height: 1.4)),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
              child: Column(children: [
                if (resume != null) ...[
                  _ResumeCard(info: resume, onTap: () => app.resumeGame()),
                  const SizedBox(height: 12),
                ],
                AppButton(
                  label: 'Create',
                  icon: Icons.add_circle_rounded,
                  tone: ButtonTone.light,
                  glow: resume == null,
                  onPressed: () => Navigator.of(context).push(fadeRoute(const CreateScreen())),
                ),
                const SizedBox(height: 12),
                Pressable(
                  label: 'Join',
                  onTap: () => Navigator.of(context).push(fadeRoute(const JoinScreen())),
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white38, width: 2)),
                    alignment: Alignment.center,
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.login_rounded, color: Colors.white, size: 22),
                      SizedBox(width: 8),
                      Text('Join', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _ResumeCard extends StatelessWidget {
  const _ResumeCard({required this.info, required this.onTap});
  final ResumeInfo info;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        label: 'Rejoin game ${info.session.gameId}',
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 10, 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white24),
          ),
          child: Row(children: [
            Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFF4ADE80), shape: BoxShape.circle)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Game ${info.session.gameId} is still going',
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(info.detail, style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ]),
            ),
            const Text('Rejoin', style: TextStyle(color: AppPalette.onStageAccent, fontSize: 15, fontWeight: FontWeight.w800)),
            const Icon(Icons.chevron_right_rounded, color: AppPalette.onStageAccent),
          ]),
        ),
      );
}

/// Short fade + slide used between screens (design: ScreenSlideSwitcher, soft).
Route<T> fadeRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 340),
      reverseTransitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(parent: animation, curve: const Cubic(0.22, 0.75, 0.2, 1));
        return FadeTransition(
          opacity: curved,
          child: SlideTransition(position: Tween(begin: const Offset(0.08, 0), end: Offset.zero).animate(curved), child: child),
        );
      },
    );
