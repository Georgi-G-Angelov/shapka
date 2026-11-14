import 'package:flutter/material.dart';

import '../game/game_controller.dart';
import '../game/rules.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Replaces results.html.
class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key, required this.game, required this.onHome, required this.onPlayAgain});
  final GameController game;
  final VoidCallback onHome;
  final VoidCallback onPlayAgain;

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  int? _open;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final s = widget.game.state!;
    final me = widget.game.me;
    final table = standings(s);
    final winners = table.where((r) => r.place == 1).toList();
    final iWon = winners.any((r) => r.players.contains(me));
    final medal = {Medal.gold: AppPalette.gold, Medal.silver: AppPalette.silver, Medal.bronze: AppPalette.bronze};
    return Scaffold(
      body: Column(children: [
        Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(center: const Alignment(0, -0.8), radius: 1.3, colors: [p.stage2, p.stage]),
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
          ),
          child: SafeArea(
            bottom: false,
            child: Column(children: [
              TopBar(title: 'Game ${widget.game.gameId}', close: true, color: Colors.white, onBack: widget.onHome),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 26),
                child: Column(children: [
                  const Icon(Icons.emoji_events_rounded, size: 58, color: AppPalette.gold),
                  const SizedBox(height: 8),
                  Text(winners.length > 1 ? "IT'S A TIE!" : iWon ? 'YOU WON!' : 'WINNERS',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppPalette.onStageAccent, letterSpacing: 1)),
                  const SizedBox(height: 6),
                  Text(winners.map((w) => w.players.join(' & ')).join('  ·  '),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, height: 1.2)),
                  const SizedBox(height: 6),
                  Text('${winners.isEmpty ? 0 : winners.first.total} words over ${s.roundCount} ${s.roundCount == 1 ? 'round' : 'rounds'}',
                      style: const TextStyle(fontSize: 15, color: Colors.white70)),
                ]),
              ),
            ]),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            children: [
              for (final row in table) ...[
                CardBox(
                  padding: EdgeInsets.zero,
                  shadow: false,
                  border: medal[row.medal],
                  child: Column(children: [
                    Pressable(
                      scale: 0.99,
                      label: '${row.players.join(' and ')}, place ${row.place}, ${row.total} words',
                      onTap: () => setState(() => _open = _open == row.team ? null : row.team),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(children: [
                          Container(
                            width: 32,
                            height: 32,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: medal[row.medal] ?? p.surfaceAlt),
                            child: Text('${row.place}',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: row.medal != null ? Colors.white : p.text3)),
                          ),
                          const SizedBox(width: 12),
                          Pair(names: row.players, color: teamColor(row.team), size: 30),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text.rich(
                              TextSpan(children: [
                                TextSpan(text: row.players.join(' & ')),
                                if (row.players.contains(me))
                                  TextSpan(text: ' (you)', style: TextStyle(color: p.text3, fontWeight: FontWeight.w600)),
                              ]),
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.text),
                            ),
                          ),
                          Text('${row.total}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: p.text)),
                          Icon(_open == row.team ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: p.text3),
                        ]),
                      ),
                    ),
                    if (_open == row.team)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          for (final r in row.perRound) ...[
                            Text('ROUND ${r.round} · ${r.kind.title.toUpperCase()} · ${r.words.length}',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: p.text3, letterSpacing: 0.8)),
                            const SizedBox(height: 6),
                            if (r.words.isEmpty)
                              Text('No words this round', style: TextStyle(fontSize: 13, color: p.text3))
                            else
                              Wrap(spacing: 6, runSpacing: 6, children: [
                                for (final w in r.words)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: teamColor(row.team).withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(99),
                                    ),
                                    child: Text(w,
                                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: teamColor(row.team))),
                                  ),
                              ]),
                            const SizedBox(height: 10),
                          ],
                        ]),
                      ),
                  ]),
                ),
                const SizedBox(height: 10),
              ],
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Thanks for playing!',
                    textAlign: TextAlign.center, style: TextStyle(fontFamily: 'MetalMania', fontSize: 24, color: p.primary)),
              ),
            ],
          ),
        ),
        BottomBar(children: [AppButton(label: 'Play again', icon: Icons.replay_rounded, onPressed: widget.onPlayAgain)]),
      ]),
    );
  }
}
