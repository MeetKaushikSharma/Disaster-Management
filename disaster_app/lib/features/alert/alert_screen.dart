import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/alert_model.dart';
import '../../core/services/audio_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/notification_service.dart';
import 'dart:async';
import 'widgets/alarm_dialog.dart';

class AlertScreen extends StatefulWidget {
  final AppLocalizations localizations;

  const AlertScreen({super.key, required this.localizations});

  @override
  State<AlertScreen> createState() => _AlertScreenState();
}

class _AlertScreenState extends State<AlertScreen> {
  bool _isLoading = true;
  double _userLat = LocationService.defaultLat;
  double _userLng = LocationService.defaultLng;
  DisasterAlert? _activeAlert;
  double? _distanceKm;
  String? _userId;
  Timer? _pollingTimer;
  String? _checkInStatus;
  bool _isSubmittingCheckIn = false;

  Future<void> _handleCheckIn(String status) async {
    setState(() => _isSubmittingCheckIn = true);
    final ok = await ApiService().submitCitizenCheckIn(
      status: status,
      lng: _userLng,
      lat: _userLat,
      district: 'Varanasi',
      eventId: _activeAlert?.id,
    );

    if (mounted) {
      setState(() {
        _isSubmittingCheckIn = false;
        if (ok) _checkInStatus = status;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(status == 'safe'
            ? '✓ Status recorded: You are marked SAFE with local authorities.'
            : '⚠️ SOS Registered: Emergency rescue teams notified of your coordinates.'),
          backgroundColor: status == 'safe' ? Colors.green.shade800 : Colors.red.shade800,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _initData();
    
    // Fallback: poll every 60 seconds for missed alerts
    _pollingTimer = Timer.periodic(const Duration(seconds: 60), (_) => _initData());
    
    // Listen for FCM-triggered refreshes
    NotificationService().onAlertReceived = () {
      if (mounted) _initData();
    };
  }
  
  @override
  void dispose() {
    _pollingTimer?.cancel();
    NotificationService().onAlertReceived = null;
    super.dispose();
  }

  Future<void> _initData() async {
    setState(() => _isLoading = true);

    // 1. Get GPS Location
    final pos = await LocationService().getCurrentLocation();
    if (pos != null) {
      _userLat = pos.latitude;
      _userLng = pos.longitude;
    }

    // 2. Register / re-register user with backend (idempotent — safe to call repeatedly)
    //    This ensures the user document exists in MongoDB with the correct location.
    _userId = await StorageService.getUserId();
    if (_userId == null) {
      // First launch: register a device user with a placeholder phone & location
      final lang = await StorageService.getLanguage();
      final fcmToken = await StorageService.getFcmToken();
      _userId = await ApiService().registerUser(
        phone: '+91${DateTime.now().millisecondsSinceEpoch % 9000000000 + 1000000000}',
        name: 'Citizen User',
        coordinates: [_userLng, _userLat],
        language: lang,
        fcmToken: fcmToken,
      );
      debugPrint('[AlertScreen] New user registered: $_userId');
      
      // If we just got the user ID, flush any pending token
      if (_userId != null) {
        await NotificationService().sendPendingToken(_userId!);
      }
    } else {
      // Already registered — just sync the latest location
      await ApiService().sendLocationHeartbeat(_userId!, _userLng, _userLat);
      debugPrint('[AlertScreen] Location synced for $_userId');
    }

    // 3. Fetch Active Disaster Events
    final events = await ApiService().getActiveDisasterEvents();
    if (events.isNotEmpty) {
      _activeAlert = events.first;
      await StorageService.saveActiveAlert(_activeAlert);

      // Compute distance
      if (_activeAlert?.centreCoords != null) {
        final clng = _activeAlert!.centreCoords![0];
        final clat = _activeAlert!.centreCoords![1];
        _distanceKm = LocationService().calculateDistanceKm(_userLat, _userLng, clat, clng);
      } else if (_activeAlert?.polygonCoords != null && _activeAlert!.polygonCoords!.isNotEmpty) {
        final firstPt = _activeAlert!.polygonCoords![0];
        _distanceKm = LocationService().calculateDistanceKm(_userLat, _userLng, firstPt[1], firstPt[0]);
      }
    } else {
      _activeAlert = await StorageService.getActiveAlert();
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _triggerSimulatedAlert() {
    final testAlert = DisasterAlert(
      id: 'sim_test_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Flash Flood & Dam Overflow Warning',
      type: 'Flood',
      severity: 'Critical',
      description: 'Severe water level rise detected. Evacuate low-lying river areas immediately and reach high ground.',
      zoneType: 'radius',
      centreCoords: [_userLng, _userLat],
      radiusKm: 15.0,
      bufferRadiusKm: 5.0,
      createdAt: DateTime.now(),
    );

    setState(() {
      _activeAlert = testAlert;
      _distanceKm = 0.5;
    });

    AudioService().playEmergencyBuzzer();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlarmDialog(
        alert: testAlert,
        onDismiss: () {
          setState(() {});
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.localizations;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.translate('app_name')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Location & Alerts',
            onPressed: _initData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.black))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Location Bar
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.grey100,
                      border: Border.all(color: AppTheme.grey300),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 18, color: AppTheme.grey700),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'GPS: ${_userLat.toStringAsFixed(4)}°N, ${_userLng.toStringAsFixed(4)}°E',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.grey800,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.white,
                            border: Border.all(color: AppTheme.grey400),
                            borderRadius: BorderRadius.circular(2),
                          ),
                          child: const Text(
                            'LIVE',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Main Status Card
                  if (_activeAlert != null) ...[
                    _buildActiveAlertCard(t),
                  ] else ...[
                    _buildNormalStatusCard(t),
                  ],

                  const SizedBox(height: 20),

                  // ── Citizen Safety Check-In Action Bar ────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.shield_outlined, size: 16, color: Colors.blue.shade800),
                            const SizedBox(width: 8),
                            const Text(
                              'CITIZEN SITUATIONAL RESPONSE',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                            ),
                            const Spacer(),
                            if (_checkInStatus != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _checkInStatus == 'safe' ? Colors.green.shade100 : Colors.red.shade100,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  _checkInStatus == 'safe' ? 'CONFIRMED SAFE' : 'HELP REQUESTED',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: _checkInStatus == 'safe' ? Colors.green.shade900 : Colors.red.shade900,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Broadcast your immediate status to district authorities and emergency response teams with your current GPS location.',
                          style: TextStyle(fontSize: 12, color: Colors.black87, height: 1.3),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF059669),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                ),
                                icon: const Icon(Icons.check_circle_outline, size: 16),
                                label: const Text('I AM SAFE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                onPressed: _isSubmittingCheckIn ? null : () => _handleCheckIn('safe'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFDC2626),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                ),
                                icon: const Icon(Icons.warning_amber_rounded, size: 16),
                                label: const Text('NEED HELP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                onPressed: _isSubmittingCheckIn ? null : () => _handleCheckIn('need_help'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Test simulation card (for examiner / prototype demo)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.black, width: 1.5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.volume_up_outlined, size: 18, color: AppTheme.black),
                            SizedBox(width: 8),
                            Text(
                              'HEAVY BUZZER TEST',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Test the full-screen emergency alert modal with continuous high-volume siren buzzer.',
                          style: TextStyle(fontSize: 12, color: AppTheme.grey600, height: 1.4),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _triggerSimulatedAlert,
                            child: Text(t.translate('test_alarm_button')),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Quick Disaster Preparedness Notice
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.grey100,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppTheme.grey200),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'INDIA DISASTER MANAGEMENT DIRECTIVE',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.grey700),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'All predefined safety guides and emergency helpline dialers are stored 100% offline on your device. They remain operational during mobile data or electricity blackouts.',
                          style: TextStyle(fontSize: 12, color: AppTheme.grey700, height: 1.5),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildNormalStatusCard(AppLocalizations t) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(color: AppTheme.grey400, width: 1.5),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
              const SizedBox(width: 10),
              Text(
                t.translate('normal_title'),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            t.translate('no_active_threat'),
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.grey600,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveAlertCard(AppLocalizations t) {
    final alert = _activeAlert!;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.black,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.white,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Text(
                  alert.severity.toUpperCase(),
                  style: const TextStyle(
                    color: AppTheme.black,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  alert.type.toUpperCase(),
                  style: const TextStyle(
                    color: AppTheme.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            alert.title,
            style: const TextStyle(
              color: AppTheme.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            alert.description,
            style: const TextStyle(
              color: AppTheme.grey300,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (_distanceKm != null) ...[
            const SizedBox(height: 12),
            Text(
              '${t.translate('distance_km')}: ${_distanceKm!.toStringAsFixed(1)} km',
              style: const TextStyle(
                color: AppTheme.grey400,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.white,
                foregroundColor: AppTheme.black,
              ),
              onPressed: () {
                AudioService().playEmergencyBuzzer();
                showDialog(
                  context: context,
                  barrierDismissible: false,
                  builder: (_) => AlarmDialog(
                    alert: alert,
                    onDismiss: () => setState(() {}),
                  ),
                );
              },
              child: const Text('OPEN ALARM & SOLUTIONS'),
            ),
          ),
        ],
      ),
    );
  }
}
