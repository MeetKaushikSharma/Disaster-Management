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

import 'package:flutter/foundation.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialise Firebase before anything else
  try {
    if (kIsWeb) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: 'AIzaSyDRn_VilEsuGVsAsicnIHewP4IpqIMIAnQ',
          appId: '1:182230964639:web:disaster_app',
          messagingSenderId: '182230964639',
          projectId: 'disaster-prevention-20355',
          storageBucket: 'disaster-prevention-20355.firebasestorage.app',
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
  } catch (e) {
    debugPrint('[Firebase] Initialization notice: $e');
  }

  // Set up background FCM handler (mobile only - not supported on web)
  if (!kIsWeb) {
    try {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    } catch (e) {
      debugPrint('[FirebaseMessaging] onBackgroundMessage notice: $e');
    }
  }

  try {
    await AudioService().init();
  } catch (e) {
    debugPrint('[AudioService] init notice: $e');
  }

  try {
    await NotificationService().init();
  } catch (e) {
    debugPrint('[NotificationService] init notice: $e');
  }

  final initialLang = await StorageService.getLanguage();
  final localizations = AppLocalizations(initialLang);
  await localizations.load();

  runApp(
    DisasterApp(
      initialLanguage: initialLang,
      initialLocalizations: localizations,
    ),
  );
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
      extendBody: true, // Needed for floating nav
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.only(left: 16, right: 16, bottom: 24),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(32),
          boxShadow: AppTheme.softShadow,
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildNavItem(
                  0,
                  'Alerts',
                  Icons.notifications_none,
                  Icons.notifications,
                  t.translate('nav_alerts'),
                ),
                _buildNavItem(
                  1,
                  'Live Map',
                  Icons.location_on_outlined,
                  Icons.location_on,
                  t.translate('nav_map'),
                ),
                _buildNavItem(
                  2,
                  'Safety Guides',
                  Icons.menu_book_outlined,
                  Icons.menu_book,
                  t.translate('nav_guides'),
                ),
                _buildNavItem(
                  3,
                  'Emergency',
                  Icons.phone_in_talk_outlined,
                  Icons.phone_in_talk,
                  t.translate('nav_sos'),
                ),
                _buildNavItem(
                  4,
                  'Settings',
                  Icons.settings_outlined,
                  Icons.settings,
                  t.translate('nav_settings'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    int index,
    String fallbackLabel,
    IconData icon,
    IconData activeIcon,
    String label,
  ) {
    final isSelected = _currentIndex == index;
    // For specific lucide icons we will integrate later. For now, use material outline/filled as placeholder
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 64, // fixed tap target
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 32,
              width: 48,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppTheme.deepBlue.withValues(alpha: 0.1)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                isSelected ? activeIcon : icon,
                color: isSelected
                    ? AppTheme.textPrimary
                    : AppTheme.textSecondary,
                size: 24,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label.isEmpty ? fallbackLabel : label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected
                    ? AppTheme.textPrimary
                    : AppTheme.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
