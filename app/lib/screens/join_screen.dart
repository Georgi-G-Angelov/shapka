import 'package:flutter/material.dart';

import '../api/shapka_api.dart';
import '../app_state.dart';
import '../game/rules.dart';
import '../widgets/common.dart';

class JoinScreen extends StatefulWidget {
  const JoinScreen({super.key});

  @override
  State<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends State<JoinScreen> {
  final _code = TextEditingController();
  late final TextEditingController _name = TextEditingController(text: AppScope.read(context).savedName);
  String? _codeError;
  String? _nameError;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final c = validateGameCode(_code.text);
    final n = validateName(_name.text);
    if (!c.ok || !n.ok) {
      setState(() {
        _codeError = c.error;
        _nameError = n.error;
      });
      return;
    }
    setState(() => _busy = true);
    final app = AppScope.read(context);
    final navigator = Navigator.of(context);
    try {
      await app.join(gameId: c.value!, name: n.value!);
      navigator.popUntil((r) => r.isFirst);
    } on ApiException catch (e) {
      if (!mounted) return;
      // Server errors land on the field they concern.
      setState(() {
        switch (e.message) {
          case 'Name already exists':
            _nameError = 'Someone in this game is already called ${n.value}. Add an initial?';
          case 'Game not found':
            _codeError = "There's no game ${c.value}. Check the code with the host.";
          default:
            if (e.message.startsWith('Game is full')) {
              _codeError = 'This game is full (${Limits.maxPlayers} players).';
            } else if (e.message.startsWith('Player name is too long')) {
              _nameError = e.message;
            } else {
              _codeError = e.status == 404 ? "There's no game ${c.value}. Check the code with the host." : e.friendly;
            }
        }
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          bottom: false,
          child: Column(children: [
            TopBar(title: 'Join game', onBack: () => Navigator.pop(context)),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                children: [
                  AppTextField(
                    label: 'Game code',
                    controller: _code,
                    placeholder: 'Enter code',
                    big: true,
                    numeric: true,
                    maxLength: 5,
                    autofocus: true,
                    action: TextInputAction.next,
                    error: _codeError,
                    onChanged: (_) => setState(() => _codeError = null),
                  ),
                  const SizedBox(height: 24),
                  AppTextField(
                    label: 'Your name',
                    controller: _name,
                    placeholder: 'e.g. Maya',
                    action: TextInputAction.go,
                    error: _nameError,
                    onSubmitted: (_) => _submit(),
                    onChanged: (_) => setState(() => _nameError = null),
                  ),
                ],
              ),
            ),
            ListenableBuilder(
              listenable: Listenable.merge([_code, _name]),
              builder: (context, _) => BottomBar(children: [
                AppButton(
                  label: 'Join game',
                  busy: _busy,
                  onPressed: _code.text.isEmpty || _name.text.trim().isEmpty ? null : _submit,
                ),
              ]),
            ),
          ]),
        ),
      );
}
