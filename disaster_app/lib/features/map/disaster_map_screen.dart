import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/models/alert_model.dart';
import '../../core/services/location_service.dart';
import '../../core/services/api_service.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_theme.dart';
import 'widgets/heat_overlay.dart';
import 'widgets/windy_map_widget.dart';

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
  List<HeatPoint> _heatPoints = [];
  HeatLayerType _selectedLayer = HeatLayerType.rainfall;
  String _selectedHorizon = 'now';
  bool _isLoading = true;
  bool _isHeatmapLoading = false;
  bool _showHeatmap = true;
  bool _isWindyLiveMode = true;

  final List<Map<String, dynamic>> _layers = [
    {'type': HeatLayerType.rainfall, 'key': 'rainfall', 'label': 'Rain', 'icon': Icons.water_drop_rounded},
    {'type': HeatLayerType.temperature, 'key': 'temperature', 'label': 'Temp', 'icon': Icons.thermostat_rounded},
    {'type': HeatLayerType.wind, 'key': 'wind', 'label': 'Wind', 'icon': Icons.air_rounded},
    {'type': HeatLayerType.river, 'key': 'river', 'label': 'River', 'icon': Icons.waves_rounded},
    {'type': HeatLayerType.risk, 'key': 'risk', 'label': 'Hazard Risk', 'icon': Icons.warning_amber_rounded},
  ];

  final List<Map<String, String>> _horizons = [
    {'id': 'now', 'label': 'LIVE'},
    {'id': '1h', 'label': '+1h'},
    {'id': '3h', 'label': '+3h'},
    {'id': '6h', 'label': '+6h (Forecast)'},
  ];

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
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

    await _fetchHeatmapPoints();
  }

  Future<void> _fetchHeatmapPoints() async {
    setState(() => _isHeatmapLoading = true);
    final activeKey = _layers.firstWhere((l) => l['type'] == _selectedLayer)['key'] as String;
    final points = await ApiService().getHeatmapGrid(layer: activeKey, horizon: _selectedHorizon);

    if (mounted) {
      setState(() {
        _heatPoints = points;
        _isHeatmapLoading = false;
      });
    }
  }

  void _centerOnUser() {
    _mapController.move(LatLng(_userLat, _userLng), 10.0);
  }

  @override
  Widget build(BuildContext context) {
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
              color: Colors.amber.withValues(alpha: 0.15),
              borderColor: Colors.amber.shade700,
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
            color: AppTheme.dangerRed.withValues(alpha: 0.25),
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
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _selectedHorizon == 'now' ? const Color(0xFF10B981) : const Color(0xFFA855F7),
                boxShadow: [
                  BoxShadow(
                    color: _selectedHorizon == 'now'
                        ? const Color(0xFF10B981).withValues(alpha: 0.6)
                        : const Color(0xFFA855F7).withValues(alpha: 0.6),
                    blurRadius: 6,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),
            Text(
              _selectedHorizon == 'now' ? 'Windy Disaster Radar' : 'Windy ML Forecast ($_selectedHorizon)',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ],
        ),
        actions: [
          // Dual-Engine Mode Toggle (Windy Live Particle Radar vs Local AI Sensor Grid)
          TextButton.icon(
            style: TextButton.styleFrom(
              backgroundColor: _isWindyLiveMode
                  ? Colors.amber.withValues(alpha: 0.22)
                  : const Color(0xFF1E293B),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: _isWindyLiveMode ? Colors.amberAccent : Colors.white24,
                  width: 1,
                ),
              ),
            ),
            icon: Icon(
              _isWindyLiveMode ? Icons.radar_rounded : Icons.sensors_rounded,
              size: 15,
              color: _isWindyLiveMode ? Colors.amberAccent : Colors.white70,
            ),
            label: Text(
              _isWindyLiveMode ? 'Windy' : 'Sensor Grid',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: _isWindyLiveMode ? Colors.amberAccent : Colors.white,
              ),
            ),
            onPressed: () => setState(() => _isWindyLiveMode = !_isWindyLiveMode),
          ),
          if (!_isWindyLiveMode)
            IconButton(
              icon: Icon(
                _showHeatmap ? Icons.layers_rounded : Icons.layers_outlined,
                color: _showHeatmap ? const Color(0xFF38BDF8) : Colors.white60,
              ),
              tooltip: 'Toggle Heatmap',
              onPressed: () => setState(() => _showHeatmap = !_showHeatmap),
            ),
          IconButton(
            icon: const Icon(Icons.my_location_rounded, color: Colors.white),
            tooltip: 'Center on my location',
            onPressed: _centerOnUser,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
          : _isWindyLiveMode
              ? WindyMapWidget(
                  initialLat: _userLat,
                  initialLng: _userLng,
                )
              : Stack(
                  children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(_userLat, _userLng),
                    initialZoom: 9.5,
                    minZoom: 4.0,
                    maxZoom: 18.0,
                  ),
                  children: [
                    // CartoDB Dark Matter tile layer for Windy dark aesthetic
                    TileLayer(
                      urlTemplate: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                      userAgentPackageName: 'com.indiasafety.disaster',
                    ),
                    // Windy-Style CustomPainter Heatmap Overlay
                    if (_showHeatmap)
                      HeatOverlayWidget(
                        points: _heatPoints,
                        layerType: _selectedLayer,
                        opacity: 0.72,
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
                            color: Color(0xFF38BDF8),
                            size: 38,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // Loading Indicator Badge for Heatmap updates
                if (_isHeatmapLoading)
                  Positioned(
                    top: 16,
                    left: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xDD0F172A),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                          ),
                          SizedBox(width: 8),
                          Text('Updating grid...', style: TextStyle(color: Colors.white70, fontSize: 11)),
                        ],
                      ),
                    ),
                  ),

                // Bottom Floating Controls (Windy-style Layer Switcher & Time Horizon)
                Positioned(
                  bottom: 20,
                  left: 12,
                  right: 12,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Time Horizon Chips (+Now, +1h, +3h, +6h)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xEE0F172A),
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(color: Colors.white12),
                          boxShadow: const [
                            BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4)),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: _horizons.map((h) {
                            final isSel = _selectedHorizon == h['id'];
                            final isPred = h['id'] != 'now';
                            return InkWell(
                              onTap: () {
                                setState(() => _selectedHorizon = h['id']!);
                                _fetchHeatmapPoints();
                              },
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isSel
                                      ? (isPred ? const Color(0xFFA855F7) : const Color(0xFF38BDF8))
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  h['label']!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? Colors.black : Colors.white70,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),

                      // Windy Layer Selector (Rain, Temp, Wind, River, Risk)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xF00F172A),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white12),
                          boxShadow: const [
                            BoxShadow(color: Colors.black45, blurRadius: 12, offset: Offset(0, 4)),
                          ],
                        ),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: _layers.map((l) {
                              final isSel = _selectedLayer == l['type'];
                              return Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: ChoiceChip(
                                  label: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(l['icon'] as IconData, size: 16, color: isSel ? Colors.black : Colors.white70),
                                      const SizedBox(width: 4),
                                      Text(l['label'] as String),
                                    ],
                                  ),
                                  selected: isSel,
                                  selectedColor: const Color(0xFF38BDF8),
                                  backgroundColor: const Color(0xFF1E293B),
                                  labelStyle: TextStyle(
                                    color: isSel ? Colors.black : Colors.white70,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    fontSize: 12,
                                  ),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                                  onSelected: (selected) {
                                    if (selected) {
                                      setState(() => _selectedLayer = l['type'] as HeatLayerType);
                                      _fetchHeatmapPoints();
                                    }
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
