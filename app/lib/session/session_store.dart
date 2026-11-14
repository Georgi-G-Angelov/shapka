import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The game this phone belongs to. The token is the game's per-player JWT.
class SavedSession {
  const SavedSession({required this.gameId, required this.name, required this.token});
  final int gameId;
  final String name;
  final String token;

  Map<String, Object> toJson() => {'gameId': gameId, 'name': name, 'token': token};
  factory SavedSession.fromJson(Map<String, dynamic> j) =>
      SavedSession(gameId: (j['gameId'] as num).toInt(), name: j['name'] as String, token: j['token'] as String);
}

/// Keeps the current game in secure storage, so a closed app (or a locked
/// phone) can rejoin; the last name is a plain preference used to prefill forms.
class SessionStore {
  SessionStore({FlutterSecureStorage? secure}) : _secure = secure ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;
  static const _sessionKey = 'shapka_session_v1';
  static const _nameKey = 'shapka_last_name';

  Future<SavedSession?> load() async {
    try {
      final raw = await _secure.read(key: _sessionKey);
      return raw == null ? null : SavedSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Exception {
      return null;
    }
  }

  Future<void> save(SavedSession session) async {
    await _secure.write(key: _sessionKey, value: jsonEncode(session.toJson()));
    await saveName(session.name);
  }

  Future<void> clear() async {
    try {
      await _secure.delete(key: _sessionKey);
    } on Exception {
      // Nothing saved.
    }
  }

  Future<String?> lastName() async => (await SharedPreferences.getInstance()).getString(_nameKey);

  Future<void> saveName(String name) async => (await SharedPreferences.getInstance()).setString(_nameKey, name);
}
