class GuideStep {
  final int order;
  final String instruction;
  final String? iconSlug;

  GuideStep({
    required this.order,
    required this.instruction,
    this.iconSlug,
  });

  factory GuideStep.fromJson(Map<String, dynamic> json) {
    return GuideStep(
      order: json['order'] is int ? json['order'] : int.tryParse(json['order'].toString()) ?? 1,
      instruction: json['instruction'] ?? '',
      iconSlug: json['iconSlug'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'order': order,
      'instruction': instruction,
      'iconSlug': iconSlug,
    };
  }
}

class SafetyGuide {
  final String id;
  final String disasterType;
  final String language;
  final String title;
  final String summary;
  final List<GuideStep> steps;

  SafetyGuide({
    required this.id,
    required this.disasterType,
    required this.language,
    required this.title,
    required this.summary,
    required this.steps,
  });

  factory SafetyGuide.fromJson(Map<String, dynamic> json) {
    var rawSteps = json['steps'] as List? ?? [];
    List<GuideStep> parsedSteps = rawSteps.map((s) => GuideStep.fromJson(s as Map<String, dynamic>)).toList();
    parsedSteps.sort((a, b) => a.order.compareTo(b.order));

    return SafetyGuide(
      id: json['_id'] ?? json['id'] ?? '',
      disasterType: json['disasterType'] ?? 'Other',
      language: json['language'] ?? 'en',
      title: json['title'] ?? 'Safety Guide',
      summary: json['summary'] ?? '',
      steps: parsedSteps,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'disasterType': disasterType,
      'language': language,
      'title': title,
      'summary': summary,
      'steps': steps.map((s) => s.toJson()).toList(),
    };
  }
}
