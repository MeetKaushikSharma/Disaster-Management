import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'core/localization/app_localizations.dart';
import 'core/services/audio_service.dart';
import 'core/services/storage_service.dart';
import 'features/alert/alert_screen.dart';
import 'features/map/disaster_map_screen.dart';
import 'features/guides/guides_screen.dart';
import 'features/sos/sos_screen.dart';
import 'features/settings/settings_screen.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialise Firebase before anything else
  await Firebase.initializeApp();
  
  // Set up background FCM handler
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  await AudioService().init();
  await NotificationService().init();

  final initialLang = await StorageService.getLanguage();
  final localizations = AppLocalizations(initialLang);
  await localizations.load();

  runApp(DisasterApp(initialLanguage: initialLang, initialLocalizations: localizations));
}

class DisasterApp extends StatefulWidget {
  final String initialLanguage;
  final AppLocalizations initialLocalizations;

  const DisasterApp({
    super.key,
    required this.initialLanguage,
    required this.initialLocalizations,
  });

  @override
  State<DisasterApp> createState() => _DisasterAppState();
}

class _DisasterAppState extends State<DisasterApp> {
  late AppLocalizations _localizations;

  @override
  void initState() {
    super.initState();
    _localizations = widget.initialLocalizations;
  }

  Future<void> _changeLanguage(String langCode) async {
    final newLoc = AppLocalizations(langCode);
    await newLoc.load();
    await StorageService.setLanguage(langCode);
    setState(() {
      _localizations = newLoc;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'India Disaster Alert',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: MainNavigationScreen(
        localizations: _localizations,
        onLanguageChanged: _changeLanguage,
      ),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  final AppLocalizations localizations;
  final ValueChanged<String> onLanguageChanged;

  const MainNavigationScreen({
    super.key,
    required this.localizations,
    required this.onLanguageChanged,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final t = widget.localizations;

    final pages = [
      AlertScreen(localizations: widget.localizations),
      DisasterMapScreen(localizations: widget.localizations),
      GuidesScreen(localizations: widget.localizations),
      SosScreen(localizations: widget.localizations),
      SettingsScreen(
        localizations: widget.localizations,
        onLanguageChanged: widget.onLanguageChanged,
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          BottomNavigationBarItem(
            icon: const Icon(Icons.warning_amber_rounded),
            activeIcon: const Icon(Icons.warning_rounded),
            label: t.translate('nav_alerts'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.map_outlined),
            activeIcon: const Icon(Icons.map_rounded),
            label: t.translate('nav_map'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.menu_book_outlined),
            activeIcon: const Icon(Icons.menu_book_rounded),
            label: t.translate('nav_guides'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.phone_in_talk_outlined),
            activeIcon: const Icon(Icons.phone_in_talk_rounded),
            label: t.translate('nav_sos'),
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.settings_outlined),
            activeIcon: const Icon(Icons.settings_rounded),
            label: t.translate('nav_settings'),
          ),
        ],
      ),
    );
  }
}
