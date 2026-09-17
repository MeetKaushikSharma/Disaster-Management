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
              color: AppTheme.grey400.withValues(alpha: 0.2),
              borderColor: AppTheme.grey600,
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
            color: AppTheme.black.withValues(alpha: 0.35),
            borderColor: AppTheme.black,
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
            color: AppTheme.black.withValues(alpha: 0.3),
            borderColor: AppTheme.black,
            borderStrokeWidth: 2.5,
          ),
        );
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(t.translate('nav_map')),
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location_rounded),
            tooltip: 'Center on my location',
            onPressed: _centerOnUser,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.black))
          : Stack(
              children: [
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
                    // User Location Marker
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(_userLat, _userLng),
                          width: 44,
                          height: 44,
                          child: const Icon(
                            Icons.person_pin_circle,
                            color: AppTheme.black,
                            size: 38,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // Map Legend Overlay (Strict B&W)
                Positioned(
                  bottom: 20,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.white,
                      border: Border.all(color: AppTheme.black, width: 1.5),
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x22000000),
                          blurRadius: 4,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: const BoxDecoration(
                                color: AppTheme.black,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text('You', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        Row(
                          children: [
                            Container(
                              width: 14,
                              height: 14,
                              decoration: BoxDecoration(
                                color: AppTheme.grey800.withValues(alpha: 0.4),
                                border: Border.all(color: AppTheme.black, width: 1.5),
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text('Disaster Zone', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        Row(
                          children: [
                            Container(
                              width: 14,
                              height: 14,
                              decoration: BoxDecoration(
                                color: AppTheme.grey300.withValues(alpha: 0.3),
                                border: Border.all(color: AppTheme.grey600, width: 1.2),
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text('Buffer (Fan-out)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
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
}
