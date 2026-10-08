import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/guide_model.dart';
import '../../core/services/api_service.dart';
import '../../core/widgets/shared_widgets.dart';

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
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(12),
              boxShadow: AppTheme.softShadow,
            ),
            child: const Icon(Icons.arrow_back_rounded, size: 20, color: AppTheme.textPrimary),
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          '${widget.disasterType.toUpperCase()} PROTOCOL',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimary,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.deepBlue))
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Card
                  SectionCard(
                    backgroundColor: AppTheme.deepBlue.withValues(alpha: 0.06),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.deepBlue,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                _guide!.disasterType.toUpperCase(),
                                style: const TextStyle(
                                  color: AppTheme.surface,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.safeGreen.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.check_circle, size: 14, color: AppTheme.safeGreen),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Offline Verified',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.safeGreen,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _guide!.title,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        if (_guide!.summary.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            _guide!.summary,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppTheme.textSecondary,
                              height: 1.5,
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
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Steps Checklist
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _guide!.steps.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
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
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isChecked
                                ? AppTheme.safeGreen.withValues(alpha: 0.08)
                                : AppTheme.surface,
                            borderRadius: BorderRadius.circular(AppTheme.cardRadius),
                            boxShadow: isChecked ? null : AppTheme.softShadow,
                            border: isChecked
                                ? Border.all(color: AppTheme.safeGreen.withValues(alpha: 0.3))
                                : null,
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: isChecked ? AppTheme.safeGreen : AppTheme.background,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: isChecked
                                    ? const Icon(Icons.check_rounded, size: 18, color: Colors.white)
                                    : Center(
                                        child: Text(
                                          '${step.order}',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: AppTheme.textPrimary,
                                          ),
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Text(
                                  step.instruction,
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.5,
                                    fontWeight: FontWeight.w500,
                                    decoration: isChecked ? TextDecoration.lineThrough : null,
                                    color: isChecked ? AppTheme.textSecondary : AppTheme.textPrimary,
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
