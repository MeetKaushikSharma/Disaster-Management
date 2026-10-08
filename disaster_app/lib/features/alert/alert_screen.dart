import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/alert_model.dart';
import '../../core/services/audio_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/notification_service.dart';
import '../../core/widgets/shared_widgets.dart';
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
          content: Text(
            status == 'safe'
                ? '✓ Status recorded: You are marked SAFE with local authorities.'
                : '⚠️ SOS Registered: Emergency rescue teams notified of your coordinates.',
          ),
          backgroundColor: status == 'safe'
              ? Colors.green.shade800
              : Colors.red.shade800,
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
    _pollingTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => _initData(),
    );

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
        phone:
            '+91${DateTime.now().millisecondsSinceEpoch % 9000000000 + 1000000000}',
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
        _distanceKm = LocationService().calculateDistanceKm(
          _userLat,
          _userLng,
          clat,
          clng,
        );
      } else if (_activeAlert?.polygonCoords != null &&
          _activeAlert!.polygonCoords!.isNotEmpty) {
        final firstPt = _activeAlert!.polygonCoords![0];
        _distanceKm = LocationService().calculateDistanceKm(
          _userLat,
          _userLng,
          firstPt[1],
          firstPt[0],
        );
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
      description:
          'Severe water level rise detected. Evacuate low-lying river areas immediately and reach high ground.',
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
      backgroundColor: AppTheme.background,
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.deepBlue),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.only(
                bottom: 120,
              ), // For floating nav bar
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // 1. Gradient Header & 2. GPS Card overlapping
                  Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.bottomCenter,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: GradientHeader(
                          title: t.translate('app_name'),
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Image.asset(
                              'assets/RaksaSetu.png',
                              width: 32,
                              height: 32,
                              fit: BoxFit.contain,
                            ),
                          ),
                          trailing: GestureDetector(
                            onTap: _initData,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  width: 1,
                                ),
                              ),
                              child: const Icon(
                                Icons.refresh_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        child: GlassGpsCard(
                          gpsText:
                              'GPS: ${_userLat.toStringAsFixed(4)}°N, ${_userLng.toStringAsFixed(4)}°E',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Padding for content
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 3. Hero card (Status)
                        if (_activeAlert != null) ...[
                          _buildActiveAlertCard(t),
                        ] else ...[
                          _buildNormalStatusCard(t),
                        ],

                        const SizedBox(height: 16),

                        // 4. CITIZEN SITUATIONAL RESPONSE
                        SectionCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.shield_outlined,
                                    size: 20,
                                    color: AppTheme.textPrimary,
                                  ),
                                  const SizedBox(width: 8),
                                  const Expanded(
                                    child: Text(
                                      'CITIZEN SITUATIONAL RESPONSE',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                  if (_checkInStatus != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _checkInStatus == 'safe'
                                            ? AppTheme.safeGreen.withValues(
                                                alpha: 0.1,
                                              )
                                            : AppTheme.dangerRed.withValues(
                                                alpha: 0.1,
                                              ),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _checkInStatus == 'safe'
                                            ? 'CONFIRMED SAFE'
                                            : 'HELP REQUESTED',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: _checkInStatus == 'safe'
                                              ? AppTheme.safeGreen
                                              : AppTheme.dangerRed,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Broadcast your immediate status to district authorities and emergency response teams with your current GPS location.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  Expanded(
                                    child: PillButton(
                                      label: 'I AM SAFE',
                                      icon: Icons.check_circle_outline,
                                      style: PillButtonStyle.green,
                                      onPressed: _isSubmittingCheckIn
                                          ? null
                                          : () => _handleCheckIn('safe'),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: PillButton(
                                      label: 'NEED HELP',
                                      icon: Icons.warning_amber_rounded,
                                      style: PillButtonStyle.red,
                                      onPressed: _isSubmittingCheckIn
                                          ? null
                                          : () => _handleCheckIn('need_help'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // 5. HEAVY BUZZER TEST
                        SectionCard(
                          backgroundColor: AppTheme.inkNavy,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(
                                    Icons.volume_up_outlined,
                                    size: 20,
                                    color: AppTheme.surface,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'HEAVY BUZZER TEST',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                      color: AppTheme.surface,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Test the full-screen emergency alert modal with continuous high-volume siren buzzer.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 20),
                              SizedBox(
                                width: double.infinity,
                                child: PillButton(
                                  label: 'SIMULATE EMERGENCY ALARM',
                                  icon: Icons
                                      .sensors_rounded, // closest to sound wave graphic
                                  style: PillButtonStyle.black,
                                  onPressed: _triggerSimulatedAlert,
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // 6. INDIA DISASTER MANAGEMENT DIRECTIVE
                        SectionCard(
                          backgroundColor: const Color(
                            0xFF8B9CB6,
                          ).withValues(alpha: 0.15), // soft blue-grey
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.cloud_off_rounded,
                                    size: 24,
                                    color: AppTheme.textPrimary,
                                  ),
                                  const SizedBox(width: 12),
                                  const Expanded(
                                    child: Text(
                                      'INDIA DISASTER MANAGEMENT DIRECTIVE',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.textPrimary,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(
                                        alpha: 0.05,
                                      ),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      '100% Offline',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.textPrimary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'All predefined safety guides and emergency helpline dialers are stored 100% offline on your device. They remain operational during mobile data or electricity blackouts.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: AppTheme.textPrimary,
                                  height: 1.5,
                                ),
                              ),
                            ],
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

  Widget _buildNormalStatusCard(AppLocalizations t) {
    return SectionCard(
      backgroundColor: const Color(0xFFF0FDF4), // soft mint background
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 3. Glowing orb with rings
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: AppTheme.safeGreen.withValues(alpha: 0.2),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.safeGreen.withValues(alpha: 0.2),
                  blurRadius: 24,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppTheme.safeGreen.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Center(
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [Color(0xFF4ADE80), AppTheme.safeGreen],
                      ),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: AppTheme.surface,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Area Status: Normal',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'No active disaster threats detected in your location perimeter.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveAlertCard(AppLocalizations t) {
    final alert = _activeAlert!;
    final isCritical = alert.severity.toLowerCase() == 'critical';
    final color = isCritical ? AppTheme.dangerRed : AppTheme.warningAmber;

    return SectionCard(
      backgroundColor: color.withValues(alpha: 0.1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.2),
                  blurRadius: 24,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: color.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Center(
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color,
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: AppTheme.surface,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Area Status: ${alert.severity}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                if (_distanceKm != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${_distanceKm!.toStringAsFixed(1)} km from threat perimeter',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Text(
                  alert.title,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: PillButton(
                    label: 'OPEN ALARM & SOLUTIONS',
                    icon: Icons.campaign_outlined,
                    style: PillButtonStyle.black,
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
