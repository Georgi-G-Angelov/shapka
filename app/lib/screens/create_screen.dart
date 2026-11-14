import 'package:flutter/material.dart';

import '../api/shapka_api.dart';
import '../app_state.dart';
import '../game/rules.dart';
import '../theme.dart';
import '../widgets/common.dart';

const roundIcons = {1: Icons.record_voice_over_rounded, 2: Icons.looks_one_rounded, 3: Icons.sports_kabaddi_rounded};

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> {
  late final TextEditingController _name = TextEditingController(text: AppScope.read(context).savedName);
  int _limit = Limits.defaultWordsPerPlayer;
  int _turnSeconds = Limits.defaultTurnSeconds;
  List<int> _rounds = const [1, 2, 3];
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final v = validateName(_name.text);
    if (!v.ok) {
      setState(() => _error = v.error);
      return;
    }
    setState(() => _busy = true);
    final app = AppScope.read(context);
    final navigator = Navigator.of(context);
    try {
      await app.create(name: v.value!, wordLimit: _limit, turnSeconds: _turnSeconds, rounds: _rounds);
      navigator.popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.friendly);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          TopBar(title: 'New game', onBack: () => Navigator.pop(context)),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              children: [
                AppTextField(
                  label: 'Your name',
                  controller: _name,
                  placeholder: 'e.g. Maya',
                  autofocus: _name.text.isEmpty,
                  error: _error,
                  action: TextInputAction.done,
                  onChanged: (_) => setState(() => _error = null),
                ),
                const SizedBox(height: 24),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                  child: Text('Words per player', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.text2)),
                ),
                NumberStepper(
                  value: _limit,
                  min: Limits.minWordsPerPlayer,
                  max: Limits.maxWordsPerPlayer,
                  noun: 'words',
                  onChanged: (v) => setState(() => _limit = v),
                ),
                const SizedBox(height: 24),
                AdvancedSettings(
                  turnSeconds: _turnSeconds,
                  rounds: _rounds,
                  onTurnSeconds: (v) => setState(() => _turnSeconds = v),
                  onRounds: (v) => setState(() => _rounds = v),
                ),
              ],
            ),
          ),
          ListenableBuilder(
            listenable: _name,
            builder: (context, _) => BottomBar(children: [
              AppButton(label: 'Create game', busy: _busy, onPressed: _name.text.trim().isEmpty ? null : _submit),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Collapsed by default; the header summarises the choice.
class AdvancedSettings extends StatefulWidget {
  const AdvancedSettings({super.key, required this.turnSeconds, required this.rounds, required this.onTurnSeconds, required this.onRounds});
  final int turnSeconds;
  final List<int> rounds;
  final ValueChanged<int> onTurnSeconds;
  final ValueChanged<List<int>> onRounds;

  @override
  State<AdvancedSettings> createState() => _AdvancedSettingsState();
}

class _AdvancedSettingsState extends State<AdvancedSettings> {
  bool _open = false;

  void _toggle(int kind) {
    final rounds = widget.rounds;
    if (rounds.contains(kind)) {
      if (rounds.length > 1) widget.onRounds([...rounds]..remove(kind));
    } else {
      widget.onRounds([...rounds, kind]..sort());
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final isDefault = widget.turnSeconds == Limits.defaultTurnSeconds && widget.rounds.length == RoundKind.all.length;
    return Container(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: p.border, offset: const Offset(0, 1))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Pressable(
          onTap: () => setState(() => _open = !_open),
          label: 'Advanced settings',
          scale: 0.99,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            child: Row(children: [
              Icon(Icons.tune_rounded, size: 22, color: p.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Advanced', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.text)),
                  const SizedBox(height: 2),
                  Text(settingsSummary(widget.turnSeconds, widget.rounds),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDefault ? p.text3 : p.primary)),
                ]),
              ),
              AnimatedRotation(
                turns: _open ? 0.5 : 0,
                duration: const Duration(milliseconds: 200),
                child: Icon(Icons.expand_more_rounded, color: p.text3),
              ),
            ]),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: !_open
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Turn length', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.text2)),
                    const SizedBox(height: 8),
                    Row(children: [
                      for (final sec in Limits.turnSeconds) ...[
                        if (sec != Limits.turnSeconds.first) const SizedBox(width: 6),
                        Expanded(
                          child: Pressable(
                            label: '$sec seconds',
                            selected: sec == widget.turnSeconds,
                            onTap: () => widget.onTurnSeconds(sec),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              height: 44,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: sec == widget.turnSeconds ? p.primary : p.surfaceAlt,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text('${sec}s',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: sec == widget.turnSeconds ? Colors.white : p.text2,
                                  )),
                            ),
                          ),
                        ),
                      ],
                    ]),
                    const SizedBox(height: 18),
                    Text('Rounds', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.text2)),
                    const SizedBox(height: 8),
                    for (final kind in RoundKind.all) ...[
                      _RoundOption(
                        kind: kind,
                        on: widget.rounds.contains(kind.number),
                        locked: widget.rounds.length == 1 && widget.rounds.contains(kind.number),
                        onTap: () => _toggle(kind.number),
                      ),
                      const SizedBox(height: 6),
                    ],
                  ]),
                ),
        ),
      ]),
    );
  }
}

class _RoundOption extends StatelessWidget {
  const _RoundOption({required this.kind, required this.on, required this.locked, required this.onTap});
  final RoundKind kind;
  final bool on;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Semantics(
      checked: on,
      child: Pressable(
        label: kind.title,
        onTap: locked ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: on ? p.primaryLight : p.surfaceAlt, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Icon(roundIcons[kind.number], size: 22, color: on ? p.primary : p.text3),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(kind.title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: on ? p.text : p.text2)),
                const SizedBox(height: 2),
                Text(kind.rule, style: TextStyle(fontSize: 12, color: p.text3)),
              ]),
            ),
            Icon(on ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                size: 24, color: on ? (locked ? p.primary.withValues(alpha: 0.45) : p.primary) : p.text3),
          ]),
        ),
      ),
    );
  }
}
