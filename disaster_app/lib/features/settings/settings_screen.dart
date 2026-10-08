import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/storage_service.dart';
import '../../core/widgets/shared_widgets.dart';

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
      backgroundColor: AppTheme.background,
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 64, 24, 0),
              child: Row(
                children: [
                  const Icon(Icons.settings_rounded, size: 28, color: AppTheme.textPrimary),
                  const SizedBox(width: 12),
                  Text(
                    t.translate('nav_settings'),
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Language Selection
                  _buildSectionLabel(t.translate('lang_select')),
                  const SizedBox(height: 10),
                  SectionCard(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _currentLang,
                        isExpanded: true,
                        icon: const Icon(Icons.language_rounded, color: AppTheme.textSecondary),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                        items: AppLocalizations.supportedLanguages.map((lang) {
                          return DropdownMenuItem<String>(
                            value: lang['code'],
                            child: Text(lang['name']!),
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

                  const SizedBox(height: 24),

                  // District Selection
                  _buildSectionLabel('EARLY WARNING ZONE / DISTRICT'),
                  const SizedBox(height: 6),
                  const Text(
                    'Filter localized IMD/CWC hydrometeorological alerts and AI anomaly detections to your regional cluster.',
                    style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  SectionCard(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _districts.any((d) => d['code'] == _selectedDistrict) ? _selectedDistrict : 'Varanasi',
                        isExpanded: true,
                        icon: const Icon(Icons.location_city_rounded, color: AppTheme.textSecondary),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                        items: _districts.map((item) {
                          return DropdownMenuItem<String>(
                            value: item['code'],
                            child: Text(item['name']!),
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

                  const SizedBox(height: 24),

                  // Backend Server Connection
                  _buildSectionLabel('BACKEND SERVER CONNECTION'),
                  const SizedBox(height: 6),
                  const Text(
                    'Configure the Express API URL (e.g. http://10.0.2.2:5000 for Android emulator or your local WiFi IP for physical phones).',
                    style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  SectionCard(
                    child: TextField(
                      controller: _urlController,
                      style: const TextStyle(fontSize: 15, color: AppTheme.textPrimary),
                      decoration: const InputDecoration(
                        hintText: 'http://10.0.2.2:5000',
                        hintStyle: TextStyle(color: AppTheme.textSecondary),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.inkNavy,
                        foregroundColor: AppTheme.surface,
                        elevation: 0,
                        minimumSize: const Size(0, AppTheme.buttonHeight),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(26),
                        ),
                      ),
                      onPressed: _saveUrl,
                      child: const Text(
                        'SAVE SERVER URL',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Battery Optimization Info
                  SectionCard(
                    backgroundColor: AppTheme.background,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.battery_charging_full_outlined, size: 22, color: AppTheme.safeGreen),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.translate('battery_safe_mode'),
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Location tracking uses smart distance filters (>500m threshold). It uses minimal battery and will not trigger background battery drain.',
                                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Zero-Cost Infrastructure Statement
                  Center(
                    child: Text(
                      '100% Free & Open Source Architecture\nPowered by OpenStreetMap & NDMA Guidelines',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary.withValues(alpha: 0.7),
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
        color: AppTheme.textSecondary,
      ),
    );
  }
}
