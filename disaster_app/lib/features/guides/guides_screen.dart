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
    'Flood',
    'Cyclone',
    'Earthquake',
    'Heatwave',
    'Landslide',
  ];

  @override
  void initState() {
    super.initState();
    _loadGuides();
  }

  Future<void> _loadGuides() async {
    final guides = await ApiService().getSafetyGuides(widget.localizations.languageCode);
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
        final matchesCat = _selectedCategory == 'All' ||
            g.disasterType.toLowerCase() == _selectedCategory.toLowerCase();
        final matchesQuery = query.isEmpty ||
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
      appBar: AppBar(
        title: Text(t.translate('nav_guides')),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.black))
          : Column(
              children: [
                // Top Notice
                Container(
                  width: double.infinity,
                  color: AppTheme.grey100,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_done_outlined, size: 16, color: AppTheme.grey700),
                      const SizedBox(width: 8),
                      Text(
                        '${t.translate('offline_available')} (Cached for network blackouts)',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.grey700),
                      ),
                    ],
                  ),
                ),

                // Search Bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (_) => _filter(),
                    decoration: InputDecoration(
                      hintText: t.translate('search_guides'),
                      hintStyle: const TextStyle(fontSize: 13, color: AppTheme.grey500),
                      prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.black),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(4),
                        borderSide: const BorderSide(color: AppTheme.grey400),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(4),
                        borderSide: const BorderSide(color: AppTheme.black, width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    ),
                  ),
                ),

                // Category Chips
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: categories.length,
                    separatorBuilder: (context, index) => const SizedBox(width: 8),
                    itemBuilder: (context, idx) {
                      final cat = categories[idx];
                      final isSelected = _selectedCategory == cat;
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedCategory = cat;
                            _filter();
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.black : AppTheme.white,
                            border: Border.all(color: AppTheme.black),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Center(
                            child: Text(
                              cat,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isSelected ? AppTheme.white : AppTheme.black,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 8),
                const Divider(),

                // Guides List
                Expanded(
                  child: _filteredGuides.isEmpty
                      ? const Center(
                          child: Text(
                            'No guides found matching criteria.',
                            style: TextStyle(color: AppTheme.grey500),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filteredGuides.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 12),
                          itemBuilder: (context, idx) {
                            final guide = _filteredGuides[idx];
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
                                  color: AppTheme.white,
                                  border: Border.all(color: AppTheme.grey300, width: 1.2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.black,
                                            borderRadius: BorderRadius.circular(2),
                                          ),
                                          child: Text(
                                            guide.disasterType.toUpperCase(),
                                            style: const TextStyle(
                                              color: AppTheme.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const Spacer(),
                                        const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.grey500),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      guide.title,
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.black,
                                      ),
                                    ),
                                    if (guide.summary.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        guide.summary,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppTheme.grey600,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
