import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/guide_model.dart';
import '../models/alert_model.dart';

class StorageService {
  static const String _keyLanguage = 'pref_language';
  static const String _keyUserId = 'user_id';
  static const String _keyBackendUrl = 'backend_url';
  static const String _keyOfflineGuides = 'offline_guides';
  static const String _keyLastAlert = 'last_active_alert';

  static Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  // Language
  static Future<String> getLanguage() async {
    final prefs = await _prefs;
    return prefs.getString(_keyLanguage) ?? 'en';
  }

  static Future<void> setLanguage(String code) async {
    final prefs = await _prefs;
    await prefs.setString(_keyLanguage, code);
  }

  // User ID
  static Future<String?> getUserId() async {
    final prefs = await _prefs;
    return prefs.getString(_keyUserId);
  }

  static Future<void> setUserId(String id) async {
    final prefs = await _prefs;
    await prefs.setString(_keyUserId, id);
  }

  // FCM Token
  static const String _keyFcmToken = 'fcm_token';
  static Future<String?> getFcmToken() async {
    final prefs = await _prefs;
    return prefs.getString(_keyFcmToken);
  }

  static Future<void> setFcmToken(String token) async {
    final prefs = await _prefs;
    await prefs.setString(_keyFcmToken, token);
  }

  // Backend URL (configurable for local dev / emulator / production)
  static Future<String> getBackendUrl() async {
    final prefs = await _prefs;
    // Defaults to local host: 10.0.2.2 for Android emulator, or localhost:5000
    return prefs.getString(_keyBackendUrl) ?? 'http://10.0.2.2:5000';
  }

  static Future<void> setBackendUrl(String url) async {
    final prefs = await _prefs;
    await prefs.setString(_keyBackendUrl, url);
  }

  // Offline Guides Cache
  static Future<void> saveGuides(List<SafetyGuide> guides) async {
    final prefs = await _prefs;
    final List<String> encoded = guides.map((g) => json.encode(g.toJson())).toList();
    await prefs.setStringList(_keyOfflineGuides, encoded);
  }

  static Future<List<SafetyGuide>> getGuides() async {
    final prefs = await _prefs;
    final List<String>? rawList = prefs.getStringList(_keyOfflineGuides);
    if (rawList == null || rawList.isEmpty) return [];

    return rawList.map((str) {
      final Map<String, dynamic> map = json.decode(str);
      return SafetyGuide.fromJson(map);
    }).toList();
  }

  // Last Active Alert Cache
  static Future<void> saveActiveAlert(DisasterAlert? alert) async {
    final prefs = await _prefs;
    if (alert == null) {
      await prefs.remove(_keyLastAlert);
    } else {
      await prefs.setString(_keyLastAlert, json.encode(alert.toJson()));
    }
  }

  static Future<DisasterAlert?> getActiveAlert() async {
    final prefs = await _prefs;
    final str = prefs.getString(_keyLastAlert);
    if (str == null) return null;
    return DisasterAlert.fromJson(json.decode(str));
  }
}
