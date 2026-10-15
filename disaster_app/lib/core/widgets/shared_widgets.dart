import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// 1. Gradient Header with Tricolor Line
class GradientHeader extends StatelessWidget {
  final String title;
  final Widget? leading;
  final Widget? trailing;
  final double height;

  const GradientHeader({
    super.key,
    required this.title,
    this.leading,
    this.trailing,
    this.height = 140,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppTheme.inkNavy, AppTheme.deepBlue],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (leading != null) ...[leading!, const SizedBox(width: 10)],
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppTheme.surface,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              ?trailing,
            ],
          ),
          // Tricolor bottom edge
          Positioned(
            bottom: -24,
            left: 0,
            right: 0,
            child: Container(
              height: 3,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.accentSaffron,
                    AppTheme.accentWhite,
                    AppTheme.accentGreen,
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// 2. Glass GPS Card
class GlassGpsCard extends StatelessWidget {
  final String gpsText;

  const GlassGpsCard({super.key, required this.gpsText});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(32),
        boxShadow: AppTheme.softShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.location_on_outlined,
            size: 18,
            color: AppTheme.textPrimary,
          ),
          const SizedBox(width: 8),
          Text(
            gpsText,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.safeGreen.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppTheme.safeGreen,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                const Text(
                  'LIVE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.safeGreen,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// 3. Section Card
class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color backgroundColor;

  const SectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.backgroundColor = AppTheme.surface,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        boxShadow: backgroundColor == AppTheme.surface
            ? AppTheme.softShadow
            : null,
      ),
      child: child,
    );
  }
}

// 4. Pill Button
enum PillButtonStyle { green, red, black }

class PillButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final PillButtonStyle style;
  final VoidCallback? onPressed;

  const PillButton({
    super.key,
    required this.label,
    required this.icon,
    required this.style,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final bg = switch (style) {
      PillButtonStyle.green => const Color(0xFFBFEFD2),
      PillButtonStyle.red => const Color(0xFFFFD2D6),
      PillButtonStyle.black => AppTheme.inkNavy,
    };
    final fg = style == PillButtonStyle.black
        ? Colors.white
        : AppTheme.textPrimary;

    return ElevatedButton.icon(
      style:
          ElevatedButton.styleFrom(
            backgroundColor: bg,
            foregroundColor: fg,
            elevation: 0,
            minimumSize: const Size(0, AppTheme.buttonHeight),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: style == PillButtonStyle.black
                  ? const BorderSide(color: Colors.white24)
                  : BorderSide.none,
            ),
          ).copyWith(
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.disabled)) {
                return bg.withValues(alpha: 0.5);
              }
              return bg;
            }),
          ),
      icon: Icon(icon, size: 18, color: fg),
      label: Flexible(
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: fg,
          ),
        ),
      ),
      onPressed: onPressed,
    );
  }
}
