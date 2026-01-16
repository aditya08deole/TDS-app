import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Animated gradient background - Theme aware
class GradientBackground extends StatelessWidget {
  final Widget child;

  const GradientBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark 
              ? AppColors.backgroundGradient 
              : AppColors.backgroundGradientLight,
        ),
      ),
      child: child,
    );
  }
}
