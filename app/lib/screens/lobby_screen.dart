import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../app_state.dart';
import '../game/game_controller.dart';
import '../game/rules.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'sheets.dart';

/// Replaces host.html + await.html.
class LobbyScreen extends StatelessWidget {
  const LobbyScreen({super.key, required this.game});
  final GameController game;

  Future<void> _leave(BuildContext context) async {
    final app = AppScope.read(context);
    final ok = await confirmSheet(context,
        icon: Icons.logout_rounded,
        title: 'Leave this game?',
        subtitle: 'Your words leave the hat with you. You can join again with the code.',
        confirm: 'Leave game');
    if (!ok || !context.mounted) return;
    if (await game.leave()) {
      if (context.mounted) context.toast('You left game ${game.gameId}', icon: Icons.logout_rounded);
      await app.goHome(forget: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final status = game.lobby;
    final app = AppScope.of(context);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          TopBar(
            title: game.isHost ? 'Your game' : '${possessive(game.host)} game',
            close: true,
            onBack: game.isHost ? () => app.goHome() : () => _leave(context),
            trailing: AppIconButton(icon: Icons.help_outline_rounded, label: 'How to play', onPressed: () => showHowToPlay(context)),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: game.refresh,
              color: p.primary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                children: [
                  _GameCodeCard(gameId: game.gameId),
                  const SizedBox(height: 16),
                  _MyWords(game: game),
                  const SizedBox(height: 16),
                  CardBox(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      SectionLabel('Players · ${status.count}',
                          trailing: Text('${status.totalWords}/${status.targetWords} words in the hat',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.text3))),
                      for (var i = 0; i < status.progress.length; i++)
                        _PlayerRow(progress: status.progress[i], game: game, first: i == 0),
                      if (status.count < Limits.maxPlayers)
                        Container(
                          padding: const EdgeInsets.only(top: 10),
                          decoration: BoxDecoration(border: Border(top: BorderSide(color: p.border))),
                          child: Row(children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: p.border, width: 2)),
                              child: Icon(Icons.person_add_rounded, size: 20, color: p.text3),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text('Waiting for friends to join with code ${game.gameId}…',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: p.text3)),
                            ),
                          ]),
                        ),
                    ]),
                  ),
                ],
              ),
            ),
          ),
          BottomBar(children: [
            if (game.isHost) ...[
              if (status.blockerMessage != null)
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(
                    switch (status.blocker) {
                      BlockerKind.odd => Icons.group_add_rounded,
                      BlockerKind.alone => Icons.person_add_rounded,
                      _ => Icons.hourglass_top_rounded,
                    },
                    size: 18,
                    color: p.text3,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(status.blockerMessage!,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: p.text2, height: 1.35)),
                  ),
                ]),
              AppButton(
                label: status.canStart ? 'Start game · ${status.count ~/ 2} teams' : 'Start game',
                icon: Icons.play_arrow_rounded,
                glow: true,
                busy: game.busy && status.canStart,
                onPressed: status.canStart ? game.start : null,
              ),
            ] else ...[
              Container(
                height: 56,
                decoration: BoxDecoration(color: p.surfaceAlt, borderRadius: BorderRadius.circular(16)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.5, color: p.primary)),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text('Waiting for ${game.host} to start',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.text2)),
                  ),
                ]),
              ),
              TextAction(label: 'Leave game', color: p.danger, onPressed: () => _leave(context)),
            ],
          ]),
        ]),
      ),
    );
  }
}

class _GameCodeCard extends StatelessWidget {
  const _GameCodeCard({required this.gameId});
  final int gameId;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: LinearGradient(colors: [p.stage2, p.primary], begin: Alignment.topLeft, end: Alignment.bottomRight),
        boxShadow: [BoxShadow(color: p.cardShadow, blurRadius: 30, offset: const Offset(0, 10), spreadRadius: -14)],
      ),
      child: Row(children: [
        Expanded(
          child: Semantics(
            label: 'Game code $gameId',
            child: ExcludeSemantics(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('GAME CODE', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                const SizedBox(height: 2),
                Text('$gameId',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 6,
                      height: 1.1,
                      fontFeatures: [FontFeature.tabularFigures()],
                    )),
              ]),
            ),
          ),
        ),
        AppIconButton(
          icon: Icons.copy_rounded,
          label: 'Copy code',
          color: Colors.white,
          background: Colors.white24,
          size: 21,
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: '$gameId'));
            if (context.mounted) context.toast('Code copied', icon: Icons.copy_rounded, kind: NoticeKind.success);
          },
        ),
        const SizedBox(width: 8),
        Builder(
          builder: (buttonContext) => AppIconButton(
            icon: Icons.ios_share_rounded,
            label: 'Share invite',
            color: Colors.white,
            background: Colors.white24,
            size: 21,
            onPressed: () {
              final box = buttonContext.findRenderObject() as RenderBox?;
              SharePlus.instance.share(ShareParams(
                text: "Join my Shapka game! Open the app, tap Join and enter code $gameId.",
                sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
              ));
            },
          ),
        ),
      ]),
    );
  }
}

class _MyWords extends StatefulWidget {
  const _MyWords({required this.game});
  final GameController game;

  @override
  State<_MyWords> createState() => _MyWordsState();
}

class _MyWordsState extends State<_MyWords> {
  final _word = TextEditingController();
  final _focus = FocusNode();
  String? _error;

  @override
  void dispose() {
    _word.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    if (_word.text.trim().isEmpty) return;
    final error = await widget.game.addWord(_word.text);
    if (!mounted) return;
    setState(() => _error = error);
    if (error == null) {
      _word.clear();
      if (widget.game.myWords.length < widget.game.wordLimit) _focus.requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final game = widget.game;
    final mine = game.myWords;
    final done = mine.length >= game.wordLimit;
    return CardBox(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Text(done ? "You're all set!" : 'Add your words',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.text)),
          ),
          if (done) Icon(Icons.check_circle_rounded, size: 20, color: p.success),
          const SizedBox(width: 4),
          Text('${mine.length}/${game.wordLimit}',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: done ? p.success : p.primary)),
        ]),
        if (!done) ...[
          const SizedBox(height: 14),
          ListenableBuilder(
            listenable: _word,
            builder: (context, _) => AppTextField(
              controller: _word,
              focusNode: _focus,
              nested: true,
              placeholder: 'Word ${mine.length + 1}',
              capitalization: TextCapitalization.none,
              error: _error,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
              onSubmitted: (_) => _add(),
              trailing: AppIconButton(
                icon: Icons.arrow_upward_rounded,
                label: 'Add word',
                color: Colors.white,
                background: _word.text.trim().isEmpty ? p.border : p.primary,
                size: 22,
                onPressed: _word.text.trim().isEmpty || game.busy ? null : _add,
              ),
            ),
          ),
        ],
        if (mine.isNotEmpty) ...[
          SizedBox(height: done ? 14 : 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final w in mine)
              Pressable(
                label: 'Remove $w',
                onTap: game.busy ? null : () => game.deleteWord(w),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                  decoration: BoxDecoration(gradient: p.primaryGradient, borderRadius: BorderRadius.circular(12)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(w, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 6),
                    const Icon(Icons.close_rounded, size: 16, color: Colors.white70),
                  ]),
                ),
              ),
          ]),
        ],
      ]),
    );
  }
}

class _PlayerRow extends StatelessWidget {
  const _PlayerRow({required this.progress, required this.game, required this.first});
  final PlayerProgress progress;
  final GameController game;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final me = progress.name == game.me;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: p.border))),
      child: Row(children: [
        Avatar(name: progress.name),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(
                child: Text(progress.name,
                    overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.text)),
              ),
              if (me) Text(' (you)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.text3)),
              if (progress.isHost) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: p.primaryLight, borderRadius: BorderRadius.circular(99)),
                  child: Text('HOST', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.4, color: p.primary)),
                ),
              ],
            ]),
            const SizedBox(height: 5),
            if (progress.done)
              Row(children: [
                Icon(Icons.check_rounded, size: 16, color: p.success),
                const SizedBox(width: 3),
                Text('Ready', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.success)),
              ])
            else
              Semantics(
                label: '${progress.have} of ${progress.need} words',
                child: Row(children: [
                  for (var i = 0; i < progress.need; i++)
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(right: 4),
                      decoration: BoxDecoration(shape: BoxShape.circle, color: i < progress.have ? p.primary : p.border),
                    ),
                  const SizedBox(width: 4),
                  Text('adding words', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: p.text3)),
                ]),
              ),
          ]),
        ),
        if (game.isHost && !me)
          AppIconButton(
            icon: Icons.person_remove_rounded,
            label: 'Remove ${progress.name}',
            color: p.text3,
            size: 22,
            onPressed: () async {
              final ok = await confirmSheet(context,
                  icon: Icons.person_remove_rounded,
                  title: 'Remove ${progress.name}?',
                  subtitle: "${possessive(progress.name)} words are taken out of the hat too.",
                  confirm: 'Remove ${progress.name}');
              if (ok) await game.kick(progress.name);
            },
          ),
      ]),
    );
  }
}
