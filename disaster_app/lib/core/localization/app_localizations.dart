import 'dart:convert';
import 'package:flutter/services.dart';

class AppLocalizations {
  final String languageCode;
  Map<String, String> _localizedStrings = {};

  AppLocalizations(this.languageCode);

  static const List<Map<String, String>> supportedLanguages = [
    {'code': 'en', 'name': 'English'},
    {'code': 'hi', 'name': 'हिन्दी (Hindi)'},
    {'code': 'ta', 'name': 'தமிழ் (Tamil)'},
    {'code': 'te', 'name': 'తెలుగు (Telugu)'},
    {'code': 'bn', 'name': 'বাংলা (Bengali)'},
    {'code': 'mr', 'name': 'मराठी (Marathi)'},
    {'code': 'gu', 'name': 'ગુજરાતી (Gujarati)'},
    {'code': 'kn', 'name': 'ಕನ್ನಡ (Kannada)'},
    {'code': 'ml', 'name': 'മലയാളം (Malayalam)'},
    {'code': 'or', 'name': 'ଓଡ଼ିଆ (Odia)'},
  ];

  Future<void> load() async {
    try {
      final jsonString = await rootBundle.loadString('assets/i18n/$languageCode.json');
      final Map<String, dynamic> jsonMap = json.decode(jsonString);
      _localizedStrings = jsonMap.map((key, value) => MapEntry(key, value.toString()));
    } catch (_) {
      // Fallback to English if file not found
      try {
        final jsonString = await rootBundle.loadString('assets/i18n/en.json');
        final Map<String, dynamic> jsonMap = json.decode(jsonString);
        _localizedStrings = jsonMap.map((key, value) => MapEntry(key, value.toString()));
      } catch (_) {
        _localizedStrings = {};
      }
    }
  }

  String translate(String key) {
    return _localizedStrings[key] ?? key;
  }
}
