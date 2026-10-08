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
  String _selectedCategory = 'All';
  bool _isLoading = true;

  static const List<String> categories = [
    'All',
    'Earthquake',
    'Flood',
    'Cyclone',
    'Fire',
    'Heatwave',
    'Landslide',
  ];

  // Icon mapping for disaster types
  static IconData _iconForType(String type) {
    switch (type.toLowerCase()) {
      case 'earthquake':
        return Icons.vibration_rounded;
      case 'flood':
        return Icons.water_rounded;
      case 'cyclone':
        return Icons.cyclone_rounded;
      case 'fire':
        return Icons.local_fire_department_rounded;
      case 'heatwave':
        return Icons.wb_sunny_rounded;
      case 'landslide':
        return Icons.terrain_rounded;
      default:
        return Icons.emergency_rounded;
    }
  }

  static Color _colorForType(String type) {
    switch (type.toLowerCase()) {
      case 'earthquake':
        return const Color(0xFF243D7A);
      case 'flood':
        return const Color(0xFF2478A8);
      case 'cyclone':
        return const Color(0xFF5D6FC7);
      case 'fire':
        return const Color(0xFFE55435);
      case 'heatwave':
        return const Color(0xFFF39B25);
      case 'landslide':
        return const Color(0xFF5D7B55);
      default:
        return AppTheme.deepBlue;
    }
  }

  List<SafetyGuide> get _previewGuides => [
    _preview('Earthquake', 'Drop, cover and hold on.'),
    _preview('Flood', 'Move to higher ground.'),
    _preview('Cyclone', 'Stay indoors and away from windows.'),
    _preview('Fire', 'Get low and leave immediately.'),
    _preview('Heatwave', 'Hydrate and avoid peak heat.'),
    _preview('Landslide', 'Move away from unstable slopes.'),
  ];

  SafetyGuide _preview(String type, String summary) => SafetyGuide(
    id: 'preview-$type',
    disasterType: type,
    language: widget.localizations.languageCode,
    title: '$type Safety Guide',
    summary: summary,
    steps: [
      GuideStep(order: 1, instruction: summary),
      GuideStep(
        order: 2,
        instruction: 'Follow official emergency instructions.',
      ),
      GuideStep(
        order: 3,
        instruction: 'Check on people around you when it is safe.',
      ),
    ],
  );

  @override
  void initState() {
    super.initState();
    _loadGuides();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadGuides() async {
    try {
      final guides = await ApiService().getSafetyGuides(
        widget.localizations.languageCode,
      );
      if (!mounted) return;
      setState(() {
        _allGuides = guides;
        _filteredGuides = guides;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  void _filter() {
    final query = _searchController.text.trim().toLowerCase();
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

  List<SafetyGuide> get _visibleGuides {
    final query = _searchController.text.trim();
    if (_allGuides.isNotEmpty) return _filteredGuides;
    if (query.isNotEmpty || _selectedCategory != 'All') {
      return _previewGuides.where((g) {
        final cat =
            _selectedCategory == 'All' ||
            g.disasterType.toLowerCase() == _selectedCategory.toLowerCase();
        final q = query.toLowerCase();
        final text = '${g.disasterType} ${g.title} ${g.summary}'.toLowerCase();
        return cat && (q.isEmpty || text.contains(q));
      }).toList();
    }
    return _previewGuides;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppTheme.background,
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.deepBlue),
        ),
      );
    }

    final guides = _visibleGuides;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHeader()),
            SliverToBoxAdapter(child: _buildSearch()),
            SliverToBoxAdapter(child: _buildCategories()),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 130),
              sliver: guides.isEmpty
                  ? SliverToBoxAdapter(child: _emptyState())
                  : SliverGrid(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _buildGuideCard(guides[index]),
                        childCount: guides.length,
                      ),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: .88,
                          ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(
              'Safety Guides',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 27,
                letterSpacing: -.6,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: const Color(0xFFDDF4EA),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  size: 13,
                  color: AppTheme.safeGreen,
                ),
                SizedBox(width: 5),
                Text(
                  'Available Offline',
                  style: TextStyle(
                    color: AppTheme.safeGreen,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      child: Container(
        height: 54,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(17),
          boxShadow: [
            BoxShadow(
              color: AppTheme.inkNavy.withValues(alpha: .08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (_) => _filter(),
          style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
          decoration: const InputDecoration(
            hintText: 'Search guides',
            hintStyle: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
            prefixIcon: Icon(
              Icons.search_rounded,
              color: AppTheme.deepBlue,
              size: 21,
            ),
            border: InputBorder.none,
            contentPadding: EdgeInsets.symmetric(vertical: 16),
          ),
        ),
      ),
    );
  }

  Widget _buildCategories() {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = categories[index];
          final selected = category == _selectedCategory;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedCategory = category);
              _filter();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 15),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? AppTheme.deepBlue : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: selected ? AppTheme.deepBlue : const Color(0xFFE2E7EF),
                ),
              ),
              child: Text(
                category,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppTheme.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildGuideCard(SafetyGuide guide) {
    final color = _colorForType(guide.disasterType);
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => GuideDetailScreen(
            disasterType: guide.disasterType,
            language: widget.localizations.languageCode,
          ),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(19),
          boxShadow: [
            BoxShadow(
              color: AppTheme.inkNavy.withValues(alpha: .075),
              blurRadius: 18,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 88,
              width: double.infinity,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .075),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Stack(
                children: [
                  Positioned(
                    right: 9,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.check_circle_rounded,
                            size: 11,
                            color: AppTheme.safeGreen,
                          ),
                          SizedBox(width: 3),
                          Text(
                            'Offline',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Center(
                    child: Icon(
                      _iconForType(guide.disasterType),
                      size: 49,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 11),
            Text(
              guide.disasterType,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              guide.summary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 10.5,
                height: 1.3,
                color: AppTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(30),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Column(
        children: [
          Icon(Icons.menu_book_rounded, size: 42, color: AppTheme.deepBlue),
          SizedBox(height: 12),
          Text(
            'No guides found',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          SizedBox(height: 5),
          Text(
            'Try another search or category.',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
