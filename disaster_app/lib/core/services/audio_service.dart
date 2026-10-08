import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class AudioService {
  static final AudioService _instance = AudioService._internal();
  factory AudioService() => _instance;
  AudioService._internal();

  final AudioPlayer _player = AudioPlayer();
  final ValueNotifier<bool> isPlayingNotifier = ValueNotifier<bool>(false);

  bool get isPlaying => isPlayingNotifier.value;

  Future<void> init() async {
    await _player.setReleaseMode(ReleaseMode.loop);
    await _player.setVolume(1.0); // Maximum volume for emergency siren
  }

  Future<void> playEmergencyBuzzer() async {
    try {
      await _player.stop();
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setVolume(1.0);
      await _player.play(AssetSource('sounds/emergency_buzzer.wav'));
      isPlayingNotifier.value = true;
    } catch (e) {
      debugPrint('Audio playback error: $e');
    }
  }

  Future<void> stopEmergencyBuzzer() async {
    try {
      await _player.stop();
      isPlayingNotifier.value = false;
    } catch (e) {
      debugPrint('Audio stop error: $e');
    }
  }

  void dispose() {
    _player.dispose();
    isPlayingNotifier.dispose();
  }
}
