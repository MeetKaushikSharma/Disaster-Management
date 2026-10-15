import 'dart:ui_web' as ui_web;
import 'package:web/web.dart' as web;
import 'package:flutter/material.dart';

Widget createWindyPlatformView({
  required String url,
  required VoidCallback onLoaded,
}) {
  return _WindyWebIframe(url: url, onLoaded: onLoaded);
}

class _WindyWebIframe extends StatefulWidget {
  final String url;
  final VoidCallback onLoaded;

  const _WindyWebIframe({
    required this.url,
    required this.onLoaded,
  });

  @override
  State<_WindyWebIframe> createState() => _WindyWebIframeState();
}

class _WindyWebIframeState extends State<_WindyWebIframe> {
  late final String _viewType;
  web.HTMLIFrameElement? _iframe;

  @override
  void initState() {
    super.initState();
    _viewType = 'windy-iframe-${DateTime.now().microsecondsSinceEpoch}';

    ui_web.platformViewRegistry.registerViewFactory(_viewType, (int viewId) {
      final iframe = web.document.createElement('iframe') as web.HTMLIFrameElement;
      iframe.src = widget.url;
      iframe.style.border = 'none';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.allow = 'geolocation; autoplay; fullscreen';
      iframe.onLoad.listen((_) {
        widget.onLoaded();
      });
      _iframe = iframe;
      return iframe;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onLoaded();
    });
  }

  @override
  void didUpdateWidget(covariant _WindyWebIframe oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url && _iframe != null) {
      _iframe!.src = widget.url;
    }
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewType);
  }
}
