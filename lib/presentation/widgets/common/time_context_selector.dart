import 'package:flutter/material.dart';
import '../../../core/theme/design_tokens.dart';

/// Time context selector for dashboard-wide temporal awareness
class TimeContextSelector extends StatelessWidget {
  final TimeMode currentMode;
  final ValueChanged<TimeMode> onModeChanged;
  final DateTime? customStart;
  final DateTime? customEnd;
  final ValueChanged<DateTimeRange>? onCustomRangeChanged;
  final bool isRefreshing;

  const TimeContextSelector({
    super.key,
    required this.currentMode,
    required this.onModeChanged,
    this.customStart,
    this.customEnd,
    this.onCustomRangeChanged,
    this.isRefreshing = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DesignTokens.space12,
        vertical: DesignTokens.space8,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        border: Border.all(
          color: Theme.of(context).dividerColor,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Refresh indicator
          if (isRefreshing) ...[
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(
                  Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
            const SizedBox(width: DesignTokens.space8),
          ] else ...[
            Icon(
              Icons.schedule,
              size: 16,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: DesignTokens.space8),
          ],
          
          // Mode selector dropdown
          DropdownButtonHideUnderline(
            child: DropdownButton<TimeMode>(
              value: currentMode,
              isDense: true,
              borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
              items: TimeMode.values.map((mode) {
                return DropdownMenuItem(
                  value: mode,
                  child: Text(
                    mode.displayName,
                    style: Theme.of(context).textTheme.bodySmall!.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                );
              }).toList(),
              onChanged: (mode) {
                if (mode != null) {
                  onModeChanged(mode);
                }
              },
            ),
          ),
          
          // Custom range picker
          if (currentMode == TimeMode.custom && onCustomRangeChanged != null) ...[
            const SizedBox(width: DesignTokens.space8),
            IconButton(
              icon: const Icon(Icons.date_range, size: 18),
              onPressed: () => _showDateRangePicker(context),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          ],
          
          // Auto-refresh indicator
          if (currentMode.autoRefresh) ...[
            const SizedBox(width: DesignTokens.space8),
            Tooltip(
              message: 'Auto-refresh every ${currentMode.refreshIntervalSeconds}s',
              child: Icon(
                Icons.sync,
                size: 14,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showDateRangePicker(BuildContext context) async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
      initialDateRange: customStart != null && customEnd != null
          ? DateTimeRange(start: customStart!, end: customEnd!)
          : DateTimeRange(
              start: now.subtract(const Duration(days: 7)),
              end: now,
            ),
    );
    
    if (picked != null) {
      onCustomRangeChanged?.call(picked);
    }
  }
}

/// Time modes matching time_context.dart
enum TimeMode {
  live,
  recent15min,
  recent1hour,
  operational24hr,
  weekly,
  custom;

  String get displayName {
    switch (this) {
      case TimeMode.live: return 'Live';
      case TimeMode.recent15min: return 'Last 15 min';
      case TimeMode.recent1hour: return 'Last hour';
      case TimeMode.operational24hr: return 'Last 24 hours';
      case TimeMode.weekly: return 'Last 7 days';
      case TimeMode.custom: return 'Custom range';
    }
  }

  bool get autoRefresh {
    return this == TimeMode.live || 
           this == TimeMode.recent15min || 
           this == TimeMode.recent1hour;
  }

  int get refreshIntervalSeconds {
    switch (this) {
      case TimeMode.live: return 5;
      case TimeMode.recent15min: return 15;
      case TimeMode.recent1hour: return 30;
      default: return 0;
    }
  }
}

/// Compact time badge for status displays
class TimeBadge extends StatelessWidget {
  final DateTime timestamp;
  final bool showRelative;

  const TimeBadge({
    super.key,
    required this.timestamp,
    this.showRelative = true,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final diff = now.difference(timestamp);

    String timeText;
    if (showRelative && diff.inMinutes < 60) {
      if (diff.inSeconds < 60) {
        timeText = 'Just now';
      } else {
        timeText = '${diff.inMinutes}m ago';
      }
    } else if (showRelative && diff.inHours < 24) {
      timeText = '${diff.inHours}h ago';
    } else {
      timeText = '${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}';
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DesignTokens.space8,
        vertical: DesignTokens.space4,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.access_time,
            size: 12,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: DesignTokens.space4),
          Text(
            timeText,
            style: Theme.of(context).textTheme.labelSmall!.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}
