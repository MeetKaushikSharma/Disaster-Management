import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/storage_service.dart';

class SettingsScreen extends StatefulWidget {
  final AppLocalizations localizations;
  final ValueChanged<String> onLanguageChanged;

  const SettingsScreen({
    super.key,
    required this.localizations,
    required this.onLanguageChanged,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _urlController = TextEditingController();
  String _currentLang = 'en';
  String _selectedDistrict = 'Varanasi';

  static const List<Map<String, String>> _districts = [
    {'code': 'Varanasi', 'name': 'Varanasi (Ganga Basin, UP)'},
    {'code': 'Gorakhpur', 'name': 'Gorakhpur (Rapti Basin, UP)'},
    {'code': 'Prayagraj', 'name': 'Prayagraj (Sangam Basin, UP)'},
    {'code': 'Lucknow', 'name': 'Lucknow (Gomti Basin, UP)'},
    {'code': 'Ayodhya', 'name': 'Ayodhya (Saryu Basin, UP)'},
    {'code': 'Patna', 'name': 'Patna (Bihar / Ganga Basin)'},
    {'code': 'All', 'name': 'All Zones (National Broadcast)'},
  ];

  @override
  void initState() {
    super.initState();
    _currentLang = widget.localizations.languageCode;
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await StorageService.getBackendUrl();
    final district = await StorageService.getDistrict();
    _urlController.text = url;
    _selectedDistrict = district;
    setState(() {});
  }

  Future<void> _saveDistrict(String district) async {
    await StorageService.setDistrict(district);
    setState(() => _selectedDistrict = district);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Monitoring district set to $district.')),
      );
    }
  }

  Future<void> _saveUrl() async {
    final url = _urlController.text.trim();
    if (url.isNotEmpty) {
      await StorageService.setBackendUrl(url);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Backend API URL saved.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.localizations;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.translate('nav_settings')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Language Selection Section
            Text(
              t.translate('lang_select').toUpperCase(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppTheme.black,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppTheme.white,
                border: Border.all(color: AppTheme.black, width: 1.5),
                borderRadius: BorderRadius.circular(4),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _currentLang,
                  isExpanded: true,
                  icon: const Icon(Icons.language, color: AppTheme.black),
                  items: AppLocalizations.supportedLanguages.map((lang) {
                    return DropdownMenuItem<String>(
                      value: lang['code'],
                      child: Text(
                        lang['name']!,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.black,
                        ),
                      ),
                    );
                  }).toList(),
                  onChanged: (newCode) {
                    if (newCode != null && newCode != _currentLang) {
                      setState(() => _currentLang = newCode);
                      widget.onLanguageChanged(newCode);
                    }
                  },
                ),
              ),
            ),

            const SizedBox(height: 28),

            // District & Regional Monitoring Section
            const Text(
              'EARLY WARNING ZONE / DISTRICT',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppTheme.black,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Filter localized IMD/CWC hydrometeorological alerts and AI anomaly detections to your regional cluster.',
              style: TextStyle(fontSize: 12, color: AppTheme.grey600, height: 1.4),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppTheme.white,
                border: Border.all(color: AppTheme.black, width: 1.5),
                borderRadius: BorderRadius.circular(4),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _districts.any((d) => d['code'] == _selectedDistrict) ? _selectedDistrict : 'Varanasi',
                  isExpanded: true,
                  icon: const Icon(Icons.location_city, color: AppTheme.black),
                  items: _districts.map((item) {
                    return DropdownMenuItem<String>(
                      value: item['code'],
                      child: Text(
                        item['name']!,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.black,
                        ),
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      _saveDistrict(val);
                    }
                  },
                ),
              ),
            ),

            const SizedBox(height: 28),

            // Server Connection Section
            const Text(
              'BACKEND SERVER CONNECTION',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppTheme.black,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Configure the Express API URL (e.g. http://10.0.2.2:5000 for Android emulator or your local WiFi IP for physical phones).',
              style: TextStyle(fontSize: 12, color: AppTheme.grey600, height: 1.4),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _urlController,
              decoration: InputDecoration(
                hintText: 'http://10.0.2.2:5000',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(4),
                  borderSide: const BorderSide(color: AppTheme.grey400),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(4),
                  borderSide: const BorderSide(color: AppTheme.black, width: 1.5),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _saveUrl,
                child: const Text('SAVE SERVER URL'),
              ),
            ),

            const SizedBox(height: 28),

            // Battery Optimization Info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.grey100,
                border: Border.all(color: AppTheme.grey300),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.battery_charging_full_outlined, size: 18, color: AppTheme.black),
                      const SizedBox(width: 8),
                      Text(
                        t.translate('battery_safe_mode'),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Location tracking uses smart distance filters (>500m threshold). It uses minimal battery and will not trigger background battery drain.',
                    style: TextStyle(fontSize: 11, color: AppTheme.grey700, height: 1.4),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Zero-Cost Infrastructure Statement
            const Center(
              child: Text(
                '100% Free & Open Source Architecture\nPowered by OpenStreetMap & NDMA Guidelines',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppTheme.grey500, height: 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
