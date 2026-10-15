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

    final isDarkScreen = _currentIndex == 1;
    final navBg = isDarkScreen ? const Color(0xFF1E293B) : AppTheme.surface;
    final navBorder = isDarkScreen
        ? Border.all(color: Colors.white24, width: 1)
        : null;

    return Scaffold(
      extendBody: false, // Prevents bottom bar from overlapping body content
      backgroundColor: isDarkScreen
          ? const Color(0xFF0F172A)
          : AppTheme.background,
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          color: isDarkScreen
              ? const Color(0xFF0F172A)
              : AppTheme.background,
          padding: const EdgeInsets.only(left: 16, right: 16, bottom: 12, top: 4),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 580),
              child: Container(
                decoration: BoxDecoration(
                  color: navBg,
                  borderRadius: BorderRadius.circular(24),
                  border: navBorder,
                  boxShadow: AppTheme.softShadow,
                ),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildNavItem(
                        0,
                        'Alerts',
                        Icons.notifications_none,
                        Icons.notifications,
                        t.translate('nav_alerts'),
                        isDarkScreen,
                      ),
                    ),
                    Expanded(
                      child: _buildNavItem(
                        1,
                        'Live Map',
                        Icons.location_on_outlined,
                        Icons.location_on,
                        t.translate('nav_map'),
                        isDarkScreen,
                      ),
                    ),
                    Expanded(
                      child: _buildNavItem(
                        2,
                        'Guides',
                        Icons.menu_book_outlined,
                        Icons.menu_book,
                        t.translate('nav_guides'),
                        isDarkScreen,
                      ),
                    ),
                    Expanded(
                      child: _buildNavItem(
                        3,
                        'SOS',
                        Icons.phone_in_talk_outlined,
                        Icons.phone_in_talk,
                        t.translate('nav_sos'),
                        isDarkScreen,
                      ),
                    ),
                    Expanded(
                      child: _buildNavItem(
                        4,
                        'Settings',
                        Icons.settings_outlined,
                        Icons.settings,
                        t.translate('nav_settings'),
                        isDarkScreen,
                      ),
                    ),
                  ],
                ),
              ),
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
    bool isDarkScreen,
  ) {
    final isSelected = _currentIndex == index;
    final activeItemBg = isDarkScreen
        ? Colors.amber.withValues(alpha: 0.22)
        : AppTheme.deepBlue;
    final activeIconColor = isDarkScreen ? Colors.amberAccent : Colors.white;
    final inactiveIconColor = isDarkScreen ? Colors.white60 : AppTheme.textSecondary;
    final activeTextColor = isDarkScreen ? Colors.amberAccent : AppTheme.textPrimary;
    final inactiveTextColor = isDarkScreen ? Colors.white60 : AppTheme.textSecondary;

    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 32,
            width: 48,
            decoration: BoxDecoration(
              color: isSelected ? activeItemBg : Colors.transparent,
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(
              isSelected ? activeIcon : icon,
              color: isSelected ? activeIconColor : inactiveIconColor,
              size: 20,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label.isEmpty ? fallbackLabel : label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              color: isSelected ? activeTextColor : inactiveTextColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
