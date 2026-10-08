import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/alert_model.dart';
import '../../core/services/location_service.dart';
import '../../core/services/api_service.dart';
import '../../core/localization/app_localizations.dart';

class DisasterMapScreen extends StatefulWidget {
  final AppLocalizations localizations;

  const DisasterMapScreen({super.key, required this.localizations});

  @override
  State<DisasterMapScreen> createState() => _DisasterMapScreenState();
}

class _DisasterMapScreenState extends State<DisasterMapScreen> {
  final MapController _mapController = MapController();
  double _userLat = LocationService.defaultLat;
  double _userLng = LocationService.defaultLng;
  List<DisasterAlert> _activeEvents = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMapData();
  }

  Future<void> _loadMapData() async {
    final pos = await LocationService().getCurrentLocation();
    if (pos != null) {
      _userLat = pos.latitude;
      _userLng = pos.longitude;
    }

    final events = await ApiService().getActiveDisasterEvents();
    if (mounted) {
      setState(() {
        _activeEvents = events;
        _isLoading = false;
      });
    }
  }

  void _centerOnUser() {
    _mapController.move(LatLng(_userLat, _userLng), 10.0);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.localizations;

    // Build circles for radius-type events
    final circles = <CircleMarker>[];
    for (final ev in _activeEvents) {
      if (ev.zoneType == 'radius' && ev.centreCoords != null && ev.radiusKm != null) {
        final centre = LatLng(ev.centreCoords![1], ev.centreCoords![0]);
        // Buffer circle
        if (ev.bufferRadiusKm > 0) {
          circles.add(
            CircleMarker(
              point: centre,
              radius: (ev.radiusKm! + ev.bufferRadiusKm) * 1000,
              useRadiusInMeter: true,
              color: const Color(0xFFFBBF24).withValues(alpha: 0.25),
              borderColor: const Color(0xFFF59E0B),
              borderStrokeWidth: 1.5,
            ),
          );
        }
        // Primary hazard circle
        circles.add(
          CircleMarker(
            point: centre,
            radius: ev.radiusKm! * 1000,
            useRadiusInMeter: true,
            color: AppTheme.dangerRed.withValues(alpha: 0.3),
            borderColor: AppTheme.dangerRed,
            borderStrokeWidth: 2.0,
          ),
        );
      }
    }

    // Build polygons for polygon-type events
    final polygons = <Polygon>[];
    for (final ev in _activeEvents) {
      if (ev.zoneType == 'polygon' && ev.polygonCoords != null && ev.polygonCoords!.isNotEmpty) {
        final pts = ev.polygonCoords!.map((pt) => LatLng(pt[1], pt[0])).toList();
        polygons.add(
          Polygon(
            points: pts,
            color: AppTheme.dangerRed.withValues(alpha: 0.25),
            borderColor: AppTheme.dangerRed,
            borderStrokeWidth: 2.5,
          ),
        );
      }
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.deepBlue))
          : Stack(
              children: [
                // --- Map ---
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(_userLat, _userLng),
                    initialZoom: 7.0,
                    minZoom: 3.0,
                    maxZoom: 18.0,
                  ),
                  children: [
                    // Free OpenStreetMap Tiles
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.indiasafety.disaster',
                    ),
                    // Hazard Circles
                    CircleLayer(circles: circles),
                    // Hazard Polygons
                    PolygonLayer(polygons: polygons),
                    // User Location Marker — blue dot with white border
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(_userLat, _userLng),
                          width: 44,
                          height: 44,
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.deepBlue,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.deepBlue.withValues(alpha: 0.35),
                                  blurRadius: 12,
                                  spreadRadius: 4,
                                ),
                              ],
                            ),
                            width: 22,
                            height: 22,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // --- Top overlays ---
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
                        // Search bar
                        Container(
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: AppTheme.softShadow,
                          ),
                          child: Row(
                            children: [
                              const SizedBox(width: 16),
                              const Icon(Icons.search, size: 22, color: AppTheme.textSecondary),
                              const SizedBox(width: 10),
                              Text(
                                t.translate('search_guides'),
                                style: const TextStyle(
                                  fontSize: 15,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Filter chips row
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _buildFilterChip('Hazards', Icons.warning_amber_rounded, false),
                              const SizedBox(width: 8),
                              _buildFilterChip('Shelters', Icons.home_rounded, true),
                              const SizedBox(width: 8),
                              _buildFilterChip('Hospitals', Icons.local_hospital_rounded, false),
                              const SizedBox(width: 8),
                              _buildFilterChip('Relief Camps', Icons.people_alt_rounded, false),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        // GPS coordinates pill
                        Align(
                          alignment: Alignment.centerRight,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppTheme.surface,
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: AppTheme.softShadow,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.gps_fixed, size: 14, color: AppTheme.textSecondary),
                                const SizedBox(width: 6),
                                Text(
                                  '${_userLat.toStringAsFixed(4)}°N, ${_userLng.toStringAsFixed(4)}°E, LIVE',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // --- FABs on right side ---
                Positioned(
                  right: 16,
                  bottom: 200,
                  child: Column(
                    children: [
                      _buildMapFab(Icons.gps_fixed, 'Recenter', _centerOnUser),
                      const SizedBox(height: 12),
                      _buildMapFab(Icons.layers_outlined, 'Layers', () {}),
                    ],
                  ),
                ),

                // --- Bottom info card ---
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 100, // above the floating nav bar
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                      boxShadow: AppTheme.softShadow,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Nearest Shelter',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Community Relief Centre',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '1.4 km, 18 min walk',
                          style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            // Capacity bar
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Capacity 62%',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                                  ),
                                  const SizedBox(height: 4),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: 0.62,
                                      backgroundColor: AppTheme.background,
                                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.safeGreen),
                                      minHeight: 6,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            // Navigate button
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.inkNavy,
                                foregroundColor: AppTheme.surface,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              ),
                              icon: const Icon(Icons.navigation_rounded, size: 18),
                              label: const Text(
                                'Navigate',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                              onPressed: () {},
                            ),
                            const SizedBox(width: 8),
                            // Call button
                            Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.textSecondary.withValues(alpha: 0.3)),
                              ),
                              child: IconButton(
                                icon: const Icon(Icons.phone_rounded, size: 20, color: AppTheme.textPrimary),
                                onPressed: () {},
                                constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildFilterChip(String label, IconData icon, bool isSelected) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? AppTheme.deepBlue : AppTheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: isSelected ? null : AppTheme.softShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: isSelected ? AppTheme.surface : AppTheme.textPrimary,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isSelected ? AppTheme.surface : AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapFab(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: AppTheme.softShadow,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppTheme.textPrimary),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
