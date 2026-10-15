import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

Widget createWindyPlatformView({
  required String url,
  required VoidCallback onLoaded,
}) {
  return _WindyMobileView(url: url, onLoaded: onLoaded);
}

class _WindyMobileView extends StatefulWidget {
  final String url;
  final VoidCallback onLoaded;

  const _WindyMobileView({
    required this.url,
    required this.onLoaded,
  });

  @override
  State<_WindyMobileView> createState() => _WindyMobileViewState();
}

class _WindyMobileViewState extends State<_WindyMobileView> {
  WebViewController? _controller;

  @override
  void initState() {
    super.initState();
    try {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF0F172A))
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) => widget.onLoaded(),
            onWebResourceError: (error) {
              debugPrint('[WindyMobileView] Error: ${error.description}');
              widget.onLoaded();
            },
          ),
        )
        ..loadRequest(Uri.parse(widget.url));
    } catch (e) {
      debugPrint('[WindyMobileView] Init error: $e');
      widget.onLoaded();
    }
  }

  @override
  void didUpdateWidget(covariant _WindyMobileView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url && _controller != null) {
      _controller!.loadRequest(Uri.parse(widget.url));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null) {
      return const SizedBox.shrink();
    }
    return WebViewWidget(controller: _controller!);
  }
}
