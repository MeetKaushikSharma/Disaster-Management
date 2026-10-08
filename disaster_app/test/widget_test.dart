import 'package:flutter_test/flutter_test.dart';
import 'package:disaster_app/main.dart';
import 'package:disaster_app/core/localization/app_localizations.dart';

void main() {
  testWidgets('DisasterApp smoke test - verifies initial build', (WidgetTester tester) async {
    final loc = AppLocalizations('en');
    await tester.pumpWidget(DisasterApp(initialLanguage: 'en', initialLocalizations: loc));
    expect(find.byType(DisasterApp), findsOneWidget);
  });
}
