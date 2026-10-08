import 'package:flutter/material.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/services/audio_service.dart';
import '../../guides/guide_detail_screen.dart';

class AlarmDialog extends StatelessWidget {
  final DisasterAlert alert;
  final VoidCallback onDismiss;

  const AlarmDialog({super.key, required this.alert, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Dialog.fullscreen(
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFF7F1D1D), // Deep red
            // Simulated concentric rings via radial gradients
            gradient: RadialGradient(
              colors: [Color(0xFF991B1B), Color(0xFF7F1D1D), Color(0xFF450A0A)],
              stops: [0.1, 0.4, 1.0],
              radius: 1.5,
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'EMERGENCY ALERT',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.0,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'TEST MODE',
                          style: TextStyle(
                            color: Colors.black,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Center Content
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.warning_rounded,
                        color: Colors.white,
                        size: 80,
                      ),
                      const SizedBox(height: 24),
                      Text(
                        alert.title.isNotEmpty
                            ? alert.title
                            : 'Hazard Detected',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        alert.description.isNotEmpty
                            ? alert.description
                            : 'Immediate hazard detected in your vicinity. Evacuate or take shelter as instructed.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3),
                            width: 1,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          color: Colors.black.withValues(alpha: 0.2),
                        ),
                        child: const Text(
                          'Active Threat Zone', // Can't resolve location without logic changes, so generic text
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Actions
                  Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                28,
                              ), // Pill shape
                            ),
                          ),
                          onPressed: () {
                            AudioService().stopEmergencyBuzzer();
                            onDismiss();
                            Navigator.of(context).pop();
                          },
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'STOP BUZZER',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.check_circle_outline, size: 20),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(
                              color: Colors.white,
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                28,
                              ), // Pill shape
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
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
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
        ),
      ),
    );
  }
}
