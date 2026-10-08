import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/guide_model.dart';
import '../../core/services/api_service.dart';
import '../../core/localization/app_localizations.dart';
import 'guide_detail_screen.dart';

class GuidesScreen extends StatefulWidget {
  final AppLocalizations localizations;

  const GuidesScreen({super.key, required this.localizations});

  @override
  State<GuidesScreen> createState() => _GuidesScreenState();
}

class _GuidesScreenState extends State<GuidesScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<SafetyGuide> _allGuides = [];
  List<SafetyGuide> _filteredGuides = [];
  final String _selectedCategory = 'All';
  bool _isLoading = true;

  static const List<String> categories = [
    'All',
    'Flood',
    'Cyclone',
    'Earthquake',
    'Heatwave',
    'Landslide',
  ];

  // Icon mapping for disaster types
  static IconData _iconForType(String type) {
    switch (type.toLowerCase()) {
      case 'earthquake':
        return Icons.public_rounded;
      case 'flood':
        return Icons.water_rounded;
      case 'cyclone':
        return Icons.cyclone_rounded;
      case 'fire':
        return Icons.local_fire_department_rounded;
      case 'heatwave':
        return Icons.wb_sunny_rounded;
      case 'landslide':
        return Icons.landscape_rounded;
      default:
        return Icons.emergency_rounded;
    }
  }

  @override
  void initState() {
    super.initState();
    _loadGuides();
  }

  Future<void> _loadGuides() async {
    final guides = await ApiService().getSafetyGuides(
      widget.localizations.languageCode,
    );
    if (mounted) {
      setState(() {
        _allGuides = guides;
        _filteredGuides = guides;
        _isLoading = false;
      });
    }
  }

  void _filter() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredGuides = _allGuides.where((g) {
        final matchesCat =
            _selectedCategory == 'All' ||
            g.disasterType.toLowerCase() == _selectedCategory.toLowerCase();
        final matchesQuery =
            query.isEmpty ||
            g.title.toLowerCase().contains(query) ||
            g.disasterType.toLowerCase().contains(query) ||
            g.summary.toLowerCase().contains(query);
        return matchesCat && matchesQuery;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.localizations;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.deepBlue),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 64, 24, 0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          t.translate('nav_guides'),
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.safeGreen.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.check_circle,
                                size: 14,
                                color: AppTheme.safeGreen,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Available Offline',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.safeGreen,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Search Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: AppTheme.softShadow,
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: (_) => _filter(),
                        decoration: InputDecoration(
                          hintText: 'Search guides',
                          hintStyle: const TextStyle(
                            fontSize: 15,
                            color: AppTheme.textSecondary,
                          ),
                          prefixIcon: const Icon(
                            Icons.search,
                            size: 22,
                            color: AppTheme.textSecondary,
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 14,
                            horizontal: 16,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Guide Grid
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _filteredGuides.isEmpty
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.all(40),
                              child: Text(
                                'No guides found matching criteria.',
                                style: TextStyle(color: AppTheme.textSecondary),
                              ),
                            ),
                          )
                        : GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 12,
                                  childAspectRatio: 1.1,
                                ),
                            itemCount: _filteredGuides.length,
                            itemBuilder: (context, idx) {
                              final guide = _filteredGuides[idx];
                              return _buildGuideCard(guide, t);
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildGuideCard(SafetyGuide guide, AppLocalizations t) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => GuideDetailScreen(
              disasterType: guide.disasterType,
              language: widget.localizations.languageCode,
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.cardRadius),
          boxShadow: AppTheme.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Icon
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.background,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _iconForType(guide.disasterType),
                size: 28,
                color: AppTheme.deepBlue,
              ),
            ),
            const Spacer(),
            // Title
            Text(
              guide.disasterType,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            // Offline badge
            Row(
              children: [
                Icon(Icons.check_circle, size: 14, color: AppTheme.safeGreen),
                const SizedBox(width: 4),
                const Text(
                  'Offline',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
