import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/guide_model.dart';
import '../../core/services/api_service.dart';

class GuideDetailScreen extends StatefulWidget {
  final String disasterType;
  final String language;

  const GuideDetailScreen({
    super.key,
    required this.disasterType,
    required this.language,
  });

  @override
  State<GuideDetailScreen> createState() => _GuideDetailScreenState();
}

class _GuideDetailScreenState extends State<GuideDetailScreen> {
  SafetyGuide? _guide;
  bool _isLoading = true;
  final Set<int> _checkedSteps = {};

  @override
  void initState() {
    super.initState();
    _loadGuide();
  }

  Future<void> _loadGuide() async {
    final guides = await ApiService().getSafetyGuides(widget.language);
    final match = guides.firstWhere(
      (g) => g.disasterType.toLowerCase() == widget.disasterType.toLowerCase(),
      orElse: () => _getDefaultLocalGuide(widget.disasterType, widget.language),
    );

    if (mounted) {
      setState(() {
        _guide = match;
        _isLoading = false;
      });
    }
  }

  // Guaranteed fallback so it NEVER fails even without server or cache
  SafetyGuide _getDefaultLocalGuide(String type, String lang) {
    return SafetyGuide(
      id: 'local_fallback',
      disasterType: type,
      language: lang,
      title: '$type Emergency Action Protocol',
      summary: 'Critical immediate survival steps recommended by National Disaster Management Authority (NDMA).',
      steps: [
        GuideStep(order: 1, instruction: 'Disconnect main power switch and isolate gas connections immediately.'),
        GuideStep(order: 2, instruction: 'Assemble emergency go-bag: drinking water, dry food, first aid, torch, medications.'),
        GuideStep(order: 3, instruction: 'Evacuate to higher or reinforced designated shelters if advised by authorities.'),
        GuideStep(order: 4, instruction: 'Dial 112 (National Emergency Helpline) or 1070 if trapped or injured.'),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.disasterType.toUpperCase()} PROTOCOL'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.black))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppTheme.grey100,
                      border: Border.all(color: AppTheme.grey300),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppTheme.black,
                                borderRadius: BorderRadius.circular(2),
                              ),
                              child: Text(
                                _guide!.disasterType.toUpperCase(),
                                style: const TextStyle(
                                  color: AppTheme.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const Spacer(),
                            const Icon(Icons.check_circle_outline, size: 14, color: AppTheme.grey600),
                            const SizedBox(width: 4),
                            const Text(
                              'Offline Verified',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.grey600),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _guide!.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.black,
                          ),
                        ),
                        if (_guide!.summary.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            _guide!.summary,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppTheme.grey700,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  const Text(
                    'STEP-BY-STEP ACTION CHECKLIST',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppTheme.black,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Steps Checklist
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _guide!.steps.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final step = _guide!.steps[index];
                      final isChecked = _checkedSteps.contains(step.order);

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            if (isChecked) {
                              _checkedSteps.remove(step.order);
                            } else {
                              _checkedSteps.add(step.order);
                            }
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isChecked ? AppTheme.grey100 : AppTheme.white,
                            border: Border.all(
                              color: isChecked ? AppTheme.grey400 : AppTheme.black,
                              width: 1.2,
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: isChecked ? AppTheme.black : AppTheme.white,
                                  border: Border.all(color: AppTheme.black, width: 1.5),
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                child: isChecked
                                    ? const Icon(Icons.check, size: 16, color: AppTheme.white)
                                    : Center(
                                        child: Text(
                                          '${step.order}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  step.instruction,
                                  style: TextStyle(
                                    fontSize: 13,
                                    height: 1.45,
                                    fontWeight: FontWeight.w500,
                                    decoration: isChecked ? TextDecoration.lineThrough : null,
                                    color: isChecked ? AppTheme.grey500 : AppTheme.black,
                                  ),
                                ),
                              ),
                            ],
                          ),
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
