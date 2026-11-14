import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../game/rules.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'create_screen.dart' show roundIcons;

Future<void> showHowToPlay(BuildContext context) => showAppSheet(context, builder: (c) {
      final p = Palette.of(c);
      Widget step(IconData icon, String title, String body) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: p.primaryLight, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 22, color: p.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.text)),
                  const SizedBox(height: 3),
                  Text(body, style: TextStyle(fontSize: 14, color: p.text2, height: 1.4)),
                ]),
              ),
            ]),
          );
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Center(child: HatLogo(size: 72)),
        const SizedBox(height: 6),
        const SheetTitle(title: 'How to play', subtitle: 'Everyone sits together. The app keeps the words, the teams and the clock.'),
        step(Icons.edit_note_rounded, 'Fill the hat', 'Everyone secretly adds the same number of words.'),
        step(Icons.groups_rounded, 'Pair up', 'Players are split into random teams of two. Sit opposite your partner.'),
        step(Icons.timer_rounded, 'Take turns',
            'Before time runs out, explain as many words as you can to your partner. Tap ✓ for each one they get.'),
        step(Icons.skip_next_rounded, 'Stuck?', 'Draw a second word and come back to the first one later.'),
        const SizedBox(height: 14),
        const SectionLabel('Rounds · same words each time'),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final r in RoundKind.all) ...[
            if (r != RoundKind.all.first) const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('ROUND ${r.number}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: p.primary)),
                  const SizedBox(height: 4),
                  Text(r.title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.text)),
                  const SizedBox(height: 4),
                  Text(r.rule, style: TextStyle(fontSize: 12, color: p.text3, height: 1.35)),
                ]),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 20),
        AppButton(label: 'Got it', onPressed: () => Navigator.pop(c)),
      ]);
    });

Future<void> showTeams(BuildContext context, {required GameController game}) => showAppSheet(context, builder: (c) {
      return ListenableBuilder(
        listenable: game,
        builder: (c, _) {
          final p = Palette.of(c);
          final s = game.state;
          if (s == null) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SheetTitle(title: 'Teams & scores', subtitle: 'Round ${s.round} of ${s.roundCount} · ${s.wordsLeft} words left in the hat'),
            for (final row in standings(s)) ...[
              CardBox(
                padding: const EdgeInsets.all(14),
                shadow: false,
                border: row.players.contains(game.me) ? teamColor(row.team) : null,
                child: Row(children: [
                  Pair(names: row.players, color: teamColor(row.team), size: 34),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(row.players.join(' & '), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.text)),
                      const SizedBox(height: 3),
                      Text(row.perRound.map((r) => 'R${r.round} ${r.round <= s.round ? r.words.length : '–'}').join(' · '),
                          style: TextStyle(fontSize: 13, color: p.text3)),
                    ]),
                  ),
                  Text('${row.total}', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: teamColor(row.team))),
                ]),
              ),
              const SizedBox(height: 10),
            ],
          ]);
        },
      );
    });

Future<void> showGameMenu(BuildContext context, {required GameController game, required VoidCallback onHome}) =>
    showAppSheet(context, builder: (c) {
      final p = Palette.of(c);
      Widget item(IconData icon, String label, VoidCallback onTap, [String? sub]) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Pressable(
              label: label,
              onTap: () {
                Navigator.pop(c);
                onTap();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(color: p.surface, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Icon(icon, size: 24, color: p.primary),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.text)),
                      if (sub != null) ...[
                        const SizedBox(height: 2),
                        Text(sub, style: TextStyle(fontSize: 13, color: p.text3)),
                      ],
                    ]),
                  ),
                  Icon(Icons.chevron_right_rounded, color: p.text3),
                ]),
              ),
            ),
          );
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SheetTitle(title: 'Game ${game.gameId}'),
        item(Icons.groups_rounded, 'Teams & scores', () => showTeams(context, game: game)),
        item(Icons.help_outline_rounded, 'How to play', () => showHowToPlay(context)),
        item(Icons.home_rounded, 'Back to home', onHome, 'You can rejoin from the home screen.'),
      ]);
    });

/// Small icon used next to a round title.
Icon roundIcon(int kind, {double size = 17, Color? color}) => Icon(roundIcons[kind], size: size, color: color);
