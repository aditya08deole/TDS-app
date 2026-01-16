import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/data_confidence.dart';
import '../../core/theme/design_tokens.dart';

/// Data confidence indicator - explicit trust communication
/// Shows operators exactly how reliable the displayed data is
class DataConfidenceIndicator extends ConsumerWidget {
  final DataConfidence confidence;
  final DateTime lastUpdated;
  final bool showLabel;
  final bool compact;

  const DataConfidenceIndicator({
    super.key,
    required this.confidence,
    required this.lastUpdated,
    this.showLabel = true,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = confidence.getColorForTheme(isDark);
    final dataAge = DateTime.now().difference(lastUpdated);

    if (compact) {
      return Tooltip(
        message: '${confidence.description}\nLast updated: ${_formatAge(dataAge)} ago',
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.space6,
            vertical: DesignTokens.space2,
          ),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Icon(
            confidence.icon,
            size: 12,
            color: color,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DesignTokens.space8,
        vertical: DesignTokens.space4,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            confidence.icon,
            size: 14,
            color: color,
          ),
          if (showLabel) ...[
            const SizedBox(width: DesignTokens.space4),
            Text(
              confidence.displayName,
              style: Theme.of(context).textTheme.labelSmall!.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(width: DesignTokens.space4),
          Text(
            _formatAge(dataAge),
            style: Theme.of(context).textTheme.labelSmall!.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }

  String _formatAge(Duration age) {
    if (age.inSeconds < 60) {
      return '${age.inSeconds}s';
    } else if (age.inMinutes < 60) {
      return '${age.inMinutes}m';
    } else if (age.inHours < 24) {
      return '${age.inHours}h';
    } else {
      return '${age.inDays}d';
    }
  }
}

/// Last known value display - transparent about data staleness
/// Used when device is offline but historical value should be shown
class LastKnownValueIndicator extends StatelessWidget {
  final double value;
  final String unit;
  final DateTime timestamp;
  final String label;

  const LastKnownValueIndicator({
    super.key,
    required this.value,
    required this.unit,
    required this.timestamp,
    this.label = 'Last Known',
  });

  @override
  Widget build(BuildContext context) {
    final age = DateTime.now().difference(timestamp);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.history,
              size: 16,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: DesignTokens.space4),
            Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall!.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
            ),
          ],
        ),
        const SizedBox(height: DesignTokens.space4),
        Text(
          '${value.toStringAsFixed(1)} $unit',
          style: Theme.of(context).textTheme.headlineSmall!.copyWith(
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
              ),
        ),
        const SizedBox(height: DesignTokens.space4),
        Text(
          _formatTimestamp(timestamp, age),
          style: Theme.of(context).textTheme.bodySmall!.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }

  String _formatTimestamp(DateTime timestamp, Duration age) {
    final timeStr = '${timestamp.hour.toString().padLeft(2, '0')}:'
        '${timestamp.minute.toString().padLeft(2, '0')}';
    
    if (age.inMinutes < 60) {
      return '$timeStr (${age.inMinutes} min ago)';
    } else if (age.inHours < 24) {
      return '$timeStr (${age.inHours} hr ago)';
    } else {
      return '$timeStr (${age.inDays} days ago)';
    }
  }
}
