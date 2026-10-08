import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/audio_service.dart';
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
  final AudioService _audioService = AudioService();
  String _currentLang = 'en';
  String _selectedDistrict = 'Varanasi';
  double _sirenVolume = 1.0;
  int _offlineGuideCount = 0;

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
    _sirenVolume = _audioService.volume;
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await StorageService.getBackendUrl();
    final district = await StorageService.getDistrict();
    final guides = await StorageService.getGuides();
    if (!mounted) return;
    setState(() {
      _urlController.text = url;
      _selectedDistrict = district;
      _offlineGuideCount = guides.length;
    });
  }

  Future<void> _saveDistrict(String district) async {
    await StorageService.setDistrict(district);
    if (!mounted) return;
    setState(() => _selectedDistrict = district);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Monitoring district set to $district.')),
    );
  }

  Future<void> _saveUrl() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;
    await StorageService.setBackendUrl(url);
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Backend API URL saved.')));
  }

  void _setVolume(double value) {
    setState(() => _sirenVolume = value);
    _audioService.setVolume(value);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 26, 20, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  'Settings',
                  style: TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1.1,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 22),

              _buildCard(
                title: 'ALERTS',
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text('Siren Volume', style: _rowStyle),
                      ),
                      Text(
                        '${(_sirenVolume * 100).round()}%',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 5,
                      activeTrackColor: AppTheme.inkNavy,
                      inactiveTrackColor: const Color(0xFFD9DEE7),
                      thumbColor: Colors.white,
                      overlayColor: AppTheme.inkNavy.withValues(alpha: .08),
                      thumbShape: const RoundSliderThumbShape(
                        enabledThumbRadius: 12,
                      ),
                    ),
                    child: Slider(
                      value: _sirenVolume,
                      min: 0,
                      max: 1,
                      onChanged: _setVolume,
                    ),
                  ),
                  const SizedBox(height: 2),
                  _infoRow(
                    Icons.volume_up_outlined,
                    'Emergency siren is ready for high-priority alerts.',
                  ),
                ],
              ),
              const SizedBox(height: 18),

              _buildCard(
                title: 'LOCATION',
                children: [
                  _settingRow(
                    icon: Icons.location_on_outlined,
                    title: 'Live GPS Tracking',
                    trailing: _enabledBadge(),
                  ),
                  const Divider(height: 24, color: Color(0xFFE9EDF2)),
                  _settingRow(
                    icon: Icons.location_city_outlined,
                    title: 'Monitoring District',
                    trailing: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 25,
                      color: AppTheme.textPrimary,
                    ),
                    onTap: _showDistrictPicker,
                  ),
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.only(left: 34),
                    child: Text(
                      _districts.firstWhere(
                        (d) => d['code'] == _selectedDistrict,
                        orElse: () => _districts.first,
                      )['name']!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              _buildCard(
                title: 'LANGUAGE',
                children: [
                  InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: _showLanguagePicker,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _languageName(),
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w500,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Hindi, and others',
                                  style: TextStyle(
                                    fontSize: 15,
                                    color: AppTheme.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 28,
                            color: AppTheme.textPrimary,
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // RakshaSetu Brand & Zero-Cost Infrastructure Statement
                  Center(
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset(
                            'assets/RaksaSetu.png',
                            width: 60,
                            height: 60,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'RakshaSetu \u2022 \u0930\u0915\u094d\u0937\u093e \u0938\u0947\u0924\u0941',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'India AI Disaster Early Warning & Management Platform\nPowered by OpenStreetMap, GloFAS & NDMA Guidelines',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSecondary.withValues(alpha: 0.8),
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              _buildCard(
                title: 'OFFLINE DATA',
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _offlineGuideCount > 0
                              ? '$_offlineGuideCount guides synced'
                              : 'Guides and dialers synced',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: AppTheme.safeGreen,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Offline data is already up to date.'),
                      ),
                    ),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Check update',
                      style: TextStyle(
                        fontSize: 17,
                        color: AppTheme.infoBlue,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              _buildCard(
                title: 'CONNECTION',
                children: [
                  const Text(
                    'Backend server URL',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: _urlController,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppTheme.textPrimary,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'http://10.0.2.2:5000',
                      border: InputBorder.none,
                      filled: true,
                      fillColor: Color(0xFFF5F7FA),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saveUrl,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.inkNavy,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        minimumSize: const Size(0, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      child: const Text(
                        'SAVE SERVER URL',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Center(
                child: Text(
                  'Version 1.0  •  India Disaster Alert',
                  style: TextStyle(
                    fontSize: 11,
                    letterSpacing: .8,
                    color: AppTheme.textSecondary.withValues(alpha: .8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const _rowStyle = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w500,
    color: AppTheme.textPrimary,
  );

  Widget _buildCard({required String title, required List<Widget> children}) {
    return SectionCard(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              letterSpacing: .7,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _settingRow({
    required IconData icon,
    required String title,
    required Widget trailing,
    VoidCallback? onTap,
  }) {
    final child = Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.textSecondary),
        const SizedBox(width: 12),
        Expanded(child: Text(title, style: _rowStyle)),
        trailing,
      ],
    );
    return onTap == null
        ? child
        : InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onTap,
            child: child,
          );
  }

  Widget _enabledBadge() {
    return Container(
      width: 52,
      height: 30,
      decoration: BoxDecoration(
        color: AppTheme.safeGreen,
        borderRadius: BorderRadius.circular(18),
      ),
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: 4),
      child: Container(
        width: 22,
        height: 22,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 17, color: AppTheme.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
          ),
        ),
      ],
    );
  }

  String _languageName() {
    final match = AppLocalizations.supportedLanguages
        .where((l) => l['code'] == _currentLang)
        .toList();
    return match.isEmpty ? 'English' : match.first['name']!;
  }

  Future<void> _showLanguagePicker() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          children: [
            const Text(
              'Select language',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            ...AppLocalizations.supportedLanguages.map(
              (lang) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(lang['name']!),
                trailing: lang['code'] == _currentLang
                    ? const Icon(Icons.check_circle, color: AppTheme.safeGreen)
                    : null,
                onTap: () => Navigator.pop(context, lang['code']),
              ),
            ),
          ],
        ),
      ),
    );
    if (selected != null && selected != _currentLang) {
      setState(() => _currentLang = selected);
      widget.onLanguageChanged(selected);
    }
  }

  Future<void> _showDistrictPicker() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          children: [
            const Text(
              'Monitoring district',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            ..._districts.map(
              (item) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item['name']!),
                trailing: item['code'] == _selectedDistrict
                    ? const Icon(Icons.check_circle, color: AppTheme.safeGreen)
                    : null,
                onTap: () => Navigator.pop(context, item['code']),
              ),
            ),
          ],
        ),
      ),
    );
    if (selected != null) await _saveDistrict(selected);
  }
}
