import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../game/game_controller.dart';
import '../game/rules.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'create_screen.dart' show roundIcons;
import 'sheets.dart';

/// Replaces game.html. One screen for every role and phase, derived from
/// [GameState.phase] and [GameState.roleOf].
class GameScreen extends StatelessWidget {
  const GameScreen({super.key, required this.game, required this.onHome});
  final GameController game;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final s = game.state!;
    final p = Palette.of(context);
    final phase = s.phase;
    final role = s.roleOf(game.me);
    final ms = game.displayMs;
    final Widget body;
    if (phase == TurnPhase.roundOver || phase == TurnPhase.gameOver) {
      body = _RoundOver(game: game, finished: phase == TurnPhase.gameOver);
    } else if (role == Role.explainer) {
      body = _Explainer(game: game, phase: phase, ms: ms);
    } else {
      body = _Watcher(game: game, phase: phase, role: role, ms: ms);
    }
    final urgent = phase == TurnPhase.live && ms <= 10000;
    return Scaffold(
      backgroundColor: p.stage,
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 600),
        decoration: BoxDecoration(gradient: p.stageGradient(urgent: urgent)),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.white),
          child: SafeArea(
            child: Column(children: [
              _Header(game: game, onHome: onHome),
              Expanded(child: body),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.game, required this.onHome});
  final GameController game;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final s = game.state!;
    return Column(children: [
      SizedBox(
        height: 52,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(children: [
            AppIconButton(
              icon: Icons.menu_rounded,
              label: 'Game menu',
              color: Colors.white,
              onPressed: () => showGameMenu(context, game: game, onHome: onHome),
            ),
            Expanded(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(roundIcons[s.roundKind.number], size: 17, color: Colors.white),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text('Round ${s.round}/${s.roundCount} · ${s.roundKind.title}',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                    ),
                  ]),
                ),
              ),
            ),
            AppIconButton(
              icon: Icons.groups_rounded,
              label: 'Teams and scores',
              color: Colors.white,
              onPressed: () => showTeams(context, game: game),
            ),
          ]),
        ),
      ),
      _ScoreStrip(game: game),
    ]);
  }
}

/// One chip per team; scrolls sideways with many teams and keeps the
/// explaining team in view.
class _ScoreStrip extends StatefulWidget {
  const _ScoreStrip({required this.game});
  final GameController game;

  @override
  State<_ScoreStrip> createState() => _ScoreStripState();
}

class _ScoreStripState extends State<_ScoreStrip> {
  final _scroll = ScrollController();
  final _keys = <int, GlobalKey>{};
  int? _current;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.game.state!;
    final current = s.teamOf(s.turnPlayer);
    final mine = s.teamOf(widget.game.me);
    if (current != _current) {
      _current = current;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _keys[current]?.currentContext;
        if (ctx != null && ctx.mounted) {
          Scrollable.ensureVisible(ctx, alignment: 0.05, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
        }
      });
    }
    return SizedBox(
      height: 40,
      child: ListView.separated(
        controller: _scroll,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: s.teams.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final active = i == current;
          final total = teamTotal(s, i);
          return Semantics(
            label: '${i == mine ? 'Your team' : s.teams[i].join(' and ')}: $total words${active ? ', playing now' : ''}',
            child: ExcludeSemantics(
              child: AnimatedContainer(
                key: _keys.putIfAbsent(i, GlobalKey.new),
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                decoration: BoxDecoration(
                  color: active ? Colors.white.withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Pair(names: s.teams[i], color: teamColor(i), size: 26, onStage: true),
                  const SizedBox(width: 8),
                  Text(i == mine ? 'You' : s.teams[i].join(' & '),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? const Color(0xFF2A0F33) : Colors.white)),
                  const SizedBox(width: 8),
                  Text('$total',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: active ? const Color(0xFF2A0F33) : Colors.white,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      )),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PersonPill extends StatelessWidget {
  const _PersonPill({required this.name, required this.color, required this.label});
  final String name;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(5, 5, 14, 5),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Avatar(name: name, size: 30, color: color, onStage: true),
          const SizedBox(width: 8),
          Flexible(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white))),
        ]),
      );
}

class _Tally extends StatelessWidget {
  const _Tally({required this.count, required this.label});
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        label: '$count ${count == 1 ? 'word' : 'words'} $label',
        child: ExcludeSemantics(
          child: Column(children: [
            TweenAnimationBuilder<double>(
              key: ValueKey(count),
              tween: Tween(begin: count == 0 ? 1 : 1.35, end: 1),
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOut,
              builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
              child: Text('$count',
                  style: const TextStyle(fontSize: 54, fontWeight: FontWeight.w900, height: 1, color: Colors.white)),
            ),
            const SizedBox(height: 8),
            Text('${count == 1 ? 'word' : 'words'} $label',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white70)),
          ]),
        ),
      );
}

class _Waiting extends StatelessWidget {
  const _Waiting(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        height: 56,
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)),
          const SizedBox(width: 10),
          Flexible(
            child: Text(text,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white70)),
          ),
        ]),
      );
}

Widget _stage(List<Widget> children) => LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight - 24),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 18), children[i]],
          ]),
        ),
      ),
    );

Widget _bottom(List<Widget> children) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 10), children[i]],
      ]),
    );

// ── Explainer ─────────────────────────────────────────────────────────────

class _Explainer extends StatelessWidget {
  const _Explainer({required this.game, required this.phase, required this.ms});
  final GameController game;
  final TurnPhase phase;
  final int ms;

  @override
  Widget build(BuildContext context) {
    final s = game.state!;
    final me = game.me;
    final mate = s.teammateOf(me) ?? '';
    final color = teamColor(s.teamOf(me) ?? 0);
    switch (phase) {
      case TurnPhase.ready:
        final carried = s.timer < s.turnLength;
        return Column(children: [
          Expanded(
            child: _stage([
              Column(children: [
                Text(carried ? 'KEEP GOING' : "YOU'RE UP",
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppPalette.onStageAccent, letterSpacing: 1)),
                const SizedBox(height: 6),
                Text('Your turn, $me!',
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Colors.white)),
              ]),
              _PersonPill(name: mate, color: color, label: 'Explain to $mate'),
              TimerRing(ms: s.timer, total: s.turnLength, size: 176),
            ]),
          ),
          _bottom([
            AppButton(
              label: 'Start · ${(s.timer / 1000).ceil()}s',
              icon: Icons.play_arrow_rounded,
              tone: ButtonTone.light,
              glow: true,
              busy: game.busy,
              onPressed: game.startTurn,
            ),
          ]),
        ]);
      case TurnPhase.live:
      case TurnPhase.paused:
        final paused = phase == TurnPhase.paused;
        final canDraw = s.wordsInPlay.length < Limits.maxWordsInPlay && s.wordsToGuess.isNotEmpty;
        final last = game.turnGuesses.isEmpty ? null : game.turnGuesses.last;
        return Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            child: Row(children: [
              Pressable(
                label: paused ? 'Resume' : 'Pause',
                onTap: paused ? game.resumeTurn : game.pauseTurn,
                child: TimerRing(ms: s.timer, total: s.turnLength, size: 84),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Explaining to', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white70)),
                  const SizedBox(height: 2),
                  Text(mate, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text('+${game.turnGuesses.length} this turn · ${s.wordsLeft} left',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFFBBF7D0))),
                ]),
              ),
              AppIconButton(
                icon: paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                label: paused ? 'Resume' : 'Pause',
                color: const Color(0xFF2A0F33),
                background: Colors.white,
                size: 26,
                onPressed: paused ? game.resumeTurn : game.pauseTurn,
              ),
            ]),
          ),
          Expanded(
            child: _stage([
              for (var i = 0; i < s.wordsInPlay.length; i++)
                _WordCard(
                  key: ValueKey(s.wordsInPlay[i]),
                  word: s.wordsInPlay[i],
                  index: s.wordsInPlay.length > 1 ? i : null,
                  hidden: paused,
                  onGotIt: paused || game.busy
                      ? null
                      : () {
                          HapticFeedback.mediumImpact();
                          game.gotIt(s.wordsInPlay[i]);
                        },
                ),
              if (paused)
                const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.pause_circle_rounded, color: Colors.white70, size: 20),
                  SizedBox(width: 6),
                  Text('Paused. Words hidden.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white70)),
                ]),
            ]),
          ),
          _bottom([
            if (!paused)
              StageOutlineButton(
                label: s.wordsInPlay.length > 1 ? 'Holding two words' : 'Stuck? Draw a second word',
                icon: Icons.style_rounded,
                onPressed: canDraw && !game.busy ? game.drawWord : null,
              ),
            if (last != null && !paused)
              Pressable(
                label: 'Undo $last',
                onTap: game.busy ? null : game.undo,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.undo_rounded, size: 18, color: Colors.white),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text('Undo “$last”',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ]),
                ),
              ),
          ]),
        ]);
      case TurnPhase.timesUp:
        final next = s.upNext;
        return Column(children: [
          Expanded(
            child: _stage([
              Container(
                width: 84,
                height: 84,
                decoration: const BoxDecoration(color: Color(0x2EFF4D6A), shape: BoxShape.circle),
                child: const Icon(Icons.notifications_active_rounded, size: 46, color: Color(0xFFFF8FA3)),
              ),
              const Text("Time's up!", style: TextStyle(fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white)),
              _Tally(count: game.turnGuesses.length, label: 'with $mate'),
              Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
                for (final w in game.turnGuesses)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0x2E4ADE80), borderRadius: BorderRadius.circular(99)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.check_rounded, size: 15, color: Color(0xFFBBF7D0)),
                      const SizedBox(width: 4),
                      Text(w, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFFBBF7D0))),
                    ]),
                  ),
              ]),
            ]),
          ),
          _bottom([
            TextAction(label: 'Stop alarm', icon: Icons.volume_off_rounded, color: Colors.white, onPressed: game.stopAlarm),
            AppButton(
              label: 'Pass to ${next?.explainer ?? 'the next player'}',
              icon: Icons.arrow_forward_rounded,
              tone: ButtonTone.light,
              glow: true,
              busy: game.busy,
              onPressed: game.passTurn,
            ),
          ]),
        ]);
      default:
        return const SizedBox.shrink();
    }
  }
}

class _WordCard extends StatelessWidget {
  const _WordCard({super.key, required this.word, required this.onGotIt, this.index, this.hidden = false});
  final String word;
  final VoidCallback? onGotIt;
  final int? index;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    final small = index != null;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.86, end: 1),
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutBack,
      builder: (context, t, child) => Transform.scale(scale: t, child: Opacity(opacity: ((t - 0.86) / 0.14).clamp(0, 1), child: child)),
      child: Container(
        padding: EdgeInsets.fromLTRB(18, small ? 14 : 22, 18, small ? 14 : 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          boxShadow: const [BoxShadow(color: Color(0x8C000000), blurRadius: 40, offset: Offset(0, 22), spreadRadius: -18)],
        ),
        child: Column(children: [
          if (index != null)
            Align(
              alignment: Alignment.centerLeft,
              child: Text('WORD ${index! + 1}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFB39DBF), letterSpacing: 0.8)),
            ),
          Padding(
            padding: EdgeInsets.symmetric(vertical: small ? 10 : 18),
            child: hidden
                ? Semantics(label: 'Word hidden while paused', child: ExcludeSemantics(child: _blurred()))
                : Text(word,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: small ? 34 : 46, fontWeight: FontWeight.w900, letterSpacing: -0.5, height: 1.1, color: const Color(0xFF1C1022))),
          ),
          Pressable(
            label: 'Got it: $word',
            scale: 0.96,
            onTap: onGotIt,
            child: Opacity(
              opacity: hidden ? 0.4 : 1,
              child: Container(
                height: small ? 52 : 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  gradient: const LinearGradient(colors: AppPalette.gotIt, begin: Alignment.topCenter, end: Alignment.bottomCenter),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.check_circle_rounded, size: small ? 24 : 28, color: Colors.white),
                  const SizedBox(width: 8),
                  Text('Got it', style: TextStyle(fontSize: small ? 18 : 20, fontWeight: FontWeight.w800, color: Colors.white)),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _blurred() => Container(
        height: index != null ? 38 : 50,
        margin: const EdgeInsets.symmetric(horizontal: 30),
        decoration: BoxDecoration(color: const Color(0xFFE9E0EE), borderRadius: BorderRadius.circular(14)),
      );
}

// ── Guesser & other team ──────────────────────────────────────────────────

class _Watcher extends StatelessWidget {
  const _Watcher({required this.game, required this.phase, required this.role, required this.ms});
  final GameController game;
  final TurnPhase phase;
  final Role role;
  final int ms;

  @override
  Widget build(BuildContext context) {
    final s = game.state!;
    final me = game.me;
    final explainer = s.turnPlayer;
    final guesser = s.teammateOf(explainer) ?? '';
    final color = teamColor(s.teamOf(explainer) ?? 0);
    final next = s.upNext;
    final meNext = next != null && (next.explainer == me || next.guesser == me);
    final guessing = role == Role.guesser;
    final nextLine = next == null
        ? null
        : next.explainer == me
            ? 'You explain next'
            : next.guesser == me
                ? 'You guess next, with ${next.explainer}'
                : 'Up next: ${next.explainer} → ${next.guesser}';

    if (phase == TurnPhase.timesUp) {
      return Column(children: [
        Expanded(
          child: _stage([
            const Icon(Icons.alarm_rounded, size: 52, color: Color(0xFFFF8FA3)),
            const Text("Time's up!", style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white)),
            _Tally(count: game.turnGuesses.length, label: guessing ? 'you got together' : 'for $explainer & $guesser'),
            if (nextLine != null)
              Text(next!.explainer == me ? 'You explain next. Get ready!' : nextLine,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: meNext ? AppPalette.highlight : Colors.white70)),
          ]),
        ),
        _bottom([_Waiting('Waiting for $explainer to pass the turn')]),
      ]);
    }

    final running = phase == TurnPhase.live || phase == TurnPhase.paused;
    return Column(children: [
      Expanded(
        child: _stage([
          Column(children: [
            Text(guessing ? "You're guessing!" : "Other team's turn",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: guessing ? 34 : 28, fontWeight: FontWeight.w900, color: Colors.white)),
            const SizedBox(height: 10),
            _PersonPill(name: explainer, color: color, label: guessing ? 'Listen to $explainer' : '$explainer is explaining to $guesser'),
          ]),
          TimerRing(
            ms: ms,
            total: s.turnLength,
            size: guessing ? 210 : 180,
            label: phase == TurnPhase.paused ? 'PAUSED' : phase == TurnPhase.ready ? 'GET READY' : null,
          ),
          if (running)
            _Tally(count: game.turnGuesses.length, label: guessing ? 'guessed' : 'this turn')
          else
            Text('$explainer will start the clock.',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white70)),
        ]),
      ),
      _bottom([
        if (!guessing && nextLine != null)
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(meNext ? Icons.bolt_rounded : Icons.schedule_rounded, size: 18, color: meNext ? AppPalette.highlight : Colors.white70),
            const SizedBox(width: 8),
            Flexible(
              child: Text(nextLine,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: meNext ? AppPalette.highlight : Colors.white70)),
            ),
          ]),
        Row(children: [
          const HatLogo(size: 22),
          const SizedBox(width: 6),
          Text('${s.wordsLeft} of ${s.totalWords} left in the hat',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white70)),
        ]),
      ]),
    ]);
  }
}

// ── Round over ────────────────────────────────────────────────────────────

class _RoundOver extends StatelessWidget {
  const _RoundOver({required this.game, required this.finished});
  final GameController game;
  final bool finished;

  @override
  Widget build(BuildContext context) {
    final s = game.state!;
    final me = game.me;
    final rows = [for (var i = 0; i < s.teams.length; i++) (team: s.teams[i], i: i, score: s.roundScore(i))]
      ..sort((a, b) => b.score - a.score);
    final keeps = s.timer >= Limits.keepTurnMinMs;
    final nextKind = finished || s.isLastRound ? null : s.roundKindAt(s.round + 1);
    final isExplainer = s.turnPlayer == me;
    return Column(children: [
      Expanded(
        child: _stage([
          const HatLogo(size: 92),
          Column(children: [
            Text('ROUND ${s.round} COMPLETE',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppPalette.onStageAccent, letterSpacing: 1)),
            const SizedBox(height: 6),
            Text(finished ? "That's the game!" : 'The hat is empty!',
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white)),
          ]),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20)),
            child: Column(children: [
              for (var k = 0; k < rows.length; k++)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(border: k == 0 ? null : const Border(top: BorderSide(color: Colors.white12))),
                  child: Row(children: [
                    Pair(names: rows[k].team, color: teamColor(rows[k].i), size: 28, onStage: true),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text.rich(TextSpan(children: [
                        TextSpan(text: rows[k].team.join(' & ')),
                        if (rows[k].team.contains(me)) const TextSpan(text: ' (you)', style: TextStyle(color: Colors.white60)),
                      ]), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                    Text('+${rows[k].score}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
                  ]),
                ),
            ]),
          ),
          if (nextKind != null)
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                child: Text('NEXT: ROUND ${s.round + 1}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white60, letterSpacing: 1)),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white24),
                ),
                child: Row(children: [
                  Icon(roundIcons[nextKind.number], size: 30, color: AppPalette.onStageAccent),
                  const SizedBox(width: 12),
                  Text(nextKind.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
                ]),
              ),
            ]),
        ]),
      ),
      _bottom([
        if (finished)
          AppButton(label: 'See the results', icon: Icons.emoji_events_rounded, tone: ButtonTone.light, glow: true, onPressed: game.showResults)
        else if (isExplainer) ...[
          if (!keeps)
            Text('${s.upNext?.explainer ?? 'The next player'} goes next.',
                style: const TextStyle(fontSize: 14, color: Colors.white70)),
          AppButton(
            label: 'Start round ${s.round + 1} · ${nextKind?.title ?? ''}',
            icon: Icons.skip_next_rounded,
            tone: ButtonTone.light,
            glow: true,
            busy: game.busy,
            onPressed: game.nextRound,
          ),
        ] else
          _Waiting('Waiting for ${s.turnPlayer} to start round ${s.round + 1}'),
      ]),
    ]);
  }
}

// ── Team reveal ───────────────────────────────────────────────────────────

/// Shown once when the game starts: teams are random.
class TeamReveal extends StatelessWidget {
  const TeamReveal({super.key, required this.game});
  final GameController game;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final s = game.state!;
    final me = game.me;
    final mine = s.teamOf(me) ?? 0;
    final mate = s.teammateOf(me) ?? '';
    return Scaffold(
      backgroundColor: p.stage,
      body: Container(
        decoration: BoxDecoration(gradient: p.stageGradient()),
        child: SafeArea(
          child: Column(children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                child: Column(children: [
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Avatar(name: me, size: 76, color: teamColor(mine), onStage: true),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14),
                      child: Icon(Icons.favorite_rounded, size: 30, color: Color(0xFFFF8FA3)),
                    ),
                    Avatar(name: mate, size: 76, color: teamColor(mine), onStage: true),
                  ]),
                  const SizedBox(height: 18),
                  Text('Your teammate is $mate',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white)),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20)),
                    child: Column(children: [
                      for (var i = 0; i < s.teams.length; i++)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(border: i == 0 ? null : const Border(top: BorderSide(color: Colors.white12))),
                          child: Row(children: [
                            Pair(names: s.teams[i], color: teamColor(i), size: 28, onStage: true),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(s.teams[i].join(' & '),
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                            ),
                            if (i == mine)
                              const Text('YOU', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppPalette.onStageAccent)),
                          ]),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 18),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.campaign_rounded, size: 20, color: AppPalette.highlight),
                    const SizedBox(width: 6),
                    Text(s.turnPlayer == me ? 'You explain first!' : '${s.turnPlayer} explains first',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppPalette.highlight)),
                  ]),
                ]),
              ),
            ),
            _bottom([AppButton(label: "Let's go", tone: ButtonTone.light, glow: true, onPressed: game.dismissTeamReveal)]),
          ]),
        ),
      ),
    );
  }
}
