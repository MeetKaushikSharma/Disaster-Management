import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/services/audio_service.dart';
import '../../guides/guide_detail_screen.dart';

class AlarmDialog extends StatelessWidget {
  final DisasterAlert alert;
  final VoidCallback onDismiss;

  const AlarmDialog({
    super.key,
    required this.alert,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false, // Prevent accidental back button press from closing emergency alarm
      child: Dialog.fullscreen(
        child: Container(
          color: AppTheme.black,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Header
              Column(
                children: [
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_amber_rounded, color: AppTheme.black, size: 24),
                        SizedBox(width: 8),
                        Text(
                          'EMERGENCY ALERT',
                          style: TextStyle(
                            color: AppTheme.black,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${alert.severity.toUpperCase()} PRIORITY: ${alert.type.toUpperCase()}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppTheme.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    alert.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppTheme.grey300,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),

              // Siren animation indicator
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.white, width: 2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.volume_up_rounded,
                      color: AppTheme.white,
                      size: 64,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'HEAVY BUZZER SOUNDING',
                      style: TextStyle(
                        color: AppTheme.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      alert.description.isNotEmpty
                          ? alert.description
                          : 'Immediate hazard detected in your vicinity. Evacuate or take shelter as instructed.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppTheme.grey300,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),

              // Actions
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.white,
                        foregroundColor: AppTheme.black,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      onPressed: () {
                        AudioService().stopEmergencyBuzzer();
                        onDismiss();
                        Navigator.of(context).pop();
                      },
                      child: const Text(
                        'ACKNOWLEDGE / STOP BUZZER',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.white,
                        side: const BorderSide(color: AppTheme.grey500, width: 1.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => GuideDetailScreen(
                              disasterType: alert.type,
                              language: 'en',
                            ),
                          ),
                        );
                      },
                      child: const Text(
                        'VIEW SAFETY INSTRUCTIONS',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
