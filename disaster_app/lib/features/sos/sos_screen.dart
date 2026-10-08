import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/widgets/shared_widgets.dart';

class SosScreen extends StatelessWidget {
  final AppLocalizations localizations;

  const SosScreen({super.key, required this.localizations});

  static const List<Map<String, String>> helplines = [
    {
      'title': 'National Emergency Number',
      'number': '112',
      'subtitle': 'Unified single emergency number across all states of India (Police, Fire, Ambulance).',
      'priority': 'true',
    },
    {
      'title': 'Disaster Management Helpline',
      'number': '1070',
      'subtitle': 'National & State Disaster Management Authority (NDMA/SDMA) Relief Control.',
      'priority': 'true',
    },
    {
      'title': 'District Disaster Control Room',
      'number': '1077',
      'subtitle': 'Direct line to your local District Magistrate emergency control team.',
      'priority': 'false',
    },
    {
      'title': 'Ambulance & Emergency Medical',
      'number': '108',
      'subtitle': 'Immediate trauma and emergency hospital transport in India.',
      'priority': 'false',
    },
    {
      'title': 'Fire & Disaster Rescue',
      'number': '101',
      'subtitle': 'Fire suppression, building collapse, and structural extrication units.',
      'priority': 'false',
    },
    {
      'title': 'Police Emergency Response',
      'number': '100',
      'subtitle': 'Law enforcement and public safety control.',
      'priority': 'false',
    },
    {
      'title': 'NDRF HQ Control Room',
      'number': '01124363260',
      'subtitle': 'National Disaster Response Force HQ Operations Room (New Delhi).',
      'priority': 'false',
    },
  ];

  // Icons for each helpline by index
  static IconData _iconForIndex(int idx) {
    switch (idx) {
      case 0:
        return Icons.emergency_rounded;
      case 1:
        return Icons.campaign_rounded;
      case 2:
        return Icons.account_balance_rounded;
      case 3:
        return Icons.local_hospital_rounded;
      case 4:
        return Icons.local_fire_department_rounded;
      case 5:
        return Icons.local_police_rounded;
      case 6:
        return Icons.shield_rounded;
      default:
        return Icons.phone_rounded;
    }
  }

  Future<void> _makeCall(BuildContext context, String number) async {
    final uri = Uri.parse('tel:$number');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not dial $number directly. Please dial manually.')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error initiating call: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = localizations;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Gradient Header
            GradientHeader(
              title: t.translate('nav_sos'),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                ),
                child: const Text(
                  'Works Offline',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ),

            // Tricolor line (the GradientHeader already has this built-in)

            const SizedBox(height: 8),

            // National Emergency (hero card)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GestureDetector(
                onTap: () => _makeCall(context, '112'),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2), // light red wash
                    borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                    boxShadow: AppTheme.softShadow,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'National Emergency',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              '112',
                              style: TextStyle(
                                fontSize: 40,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.textPrimary,
                                height: 1.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppTheme.dangerRed,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.dangerRed.withValues(alpha: 0.3),
                              blurRadius: 12,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.phone_rounded, color: Colors.white, size: 28),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Remaining helplines
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: helplines.length - 1, // skip first (already shown as hero)
                separatorBuilder: (context, index) => const SizedBox(height: 10),
                itemBuilder: (context, idx) {
                  final actualIdx = idx + 1; // offset because hero is index 0
                  final item = helplines[actualIdx];

                  return GestureDetector(
                    onTap: () => _makeCall(context, item['number']!),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                        boxShadow: AppTheme.softShadow,
                      ),
                      child: Row(
                        children: [
                          // Icon
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppTheme.background,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              _iconForIndex(actualIdx),
                              size: 24,
                              color: AppTheme.deepBlue,
                            ),
                          ),
                          const SizedBox(width: 14),
                          // Title + Number
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item['title']!,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item['number']!,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Green call button
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppTheme.safeGreen,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppTheme.safeGreen.withValues(alpha: 0.25),
                                  blurRadius: 8,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                            child: const Icon(Icons.phone_rounded, color: Colors.white, size: 22),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),

            // Share location via SMS card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                  boxShadow: AppTheme.softShadow,
                ),
                child: const Row(
                  children: [
                    Icon(Icons.near_me_rounded, size: 28, color: AppTheme.deepBlue),
                    SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Share my location via SMS',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Send your coordinates in one tap',
                            style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
