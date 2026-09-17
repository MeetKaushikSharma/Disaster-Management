import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';

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
      appBar: AppBar(
        title: Text(t.translate('nav_sos')),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Emergency Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.black,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.translate('sos_title').toUpperCase(),
                    style: const TextStyle(
                      color: AppTheme.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    t.translate('sos_subtitle'),
                    style: const TextStyle(
                      color: AppTheme.grey300,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Helplines List
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: helplines.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, idx) {
                final item = helplines[idx];
                final isPriority = item['priority'] == 'true';

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.white,
                    border: Border.all(
                      color: isPriority ? AppTheme.black : AppTheme.grey300,
                      width: isPriority ? 2.0 : 1.0,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['title']!,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.black,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item['subtitle']!,
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.grey600,
                                height: 1.3,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'TEL: ${item['number']!}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.black,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.black,
                          foregroundColor: AppTheme.white,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        icon: const Icon(Icons.phone_in_talk, size: 16),
                        label: Text(
                          t.translate('call_now'),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                        onPressed: () => _makeCall(context, item['number']!),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
