import 'dart:async';
import 'dart:math';

import 'package:audioplayers/audioplayers.dart';

/// Time's-up alarm: one of the web client's three sounds, looped for at most
/// ten seconds (as static/ts/game.ts), loud even with the ring switch off.
abstract class Alarm {
  void ring();
  void stop();
  void dispose();
}

class AudioAlarm implements Alarm {
  static const sounds = ['sounds/mbt_gadove.m4a', 'sounds/mbt_nema_kvo.m4a', 'sounds/mbt_risk.m4a'];
  AudioPlayer? _player;
  Timer? _limit;
  final _random = Random();

  @override
  Future<void> ring() async {
    stop();
    final player = _player = AudioPlayer();
    try {
      await player.setAudioContext(AudioContextConfig(respectSilence: false, focus: AudioContextConfigFocus.duckOthers).build());
      await player.setReleaseMode(ReleaseMode.loop);
      await player.play(AssetSource(sounds[_random.nextInt(sounds.length)]));
    } on Object {
      // No sound is better than a crash mid-game.
    }
    _limit = Timer(const Duration(seconds: 10), stop);
  }

  @override
  void stop() {
    _limit?.cancel();
    final player = _player;
    _player = null;
    if (player != null) {
      player.stop().whenComplete(player.dispose);
    }
  }

  @override
  void dispose() => stop();
}
