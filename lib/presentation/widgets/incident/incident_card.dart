import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/entities/incident.dart';
import '../../../domain/entities/incident_state.dart';
import '../../../domain/entities/data_confidence.dart';
import '../../../core/theme/design_tokens.dart';
import '../data_confidence_indicator.dart';

/// Government-grade incident card
/// Designed for institutional credibility, 2AM readability, and regulatory compliance
class IncidentCard extends ConsumerWidget {
  final Incident incident;
  final DataConfidence? dataConfidence;
  final VoidCallback? onTap;
  final VoidCallback? onAcknowledge;
  final VoidCallback? onResolve;

  const IncidentCard({
    super.key,
    required this.incident,
    this.dataConfidence,
    this.onTap,
    this.onAcknowledge,
    this.onResolve,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final severityColor = incident.severity.getColorForTheme(isDark);
    final showLowConfidenceWarning =
        dataConfidence != null && dataConfidence!.requiresAttention;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(
        horizontal: DesignTokens.space16,
        vertical: DesignTokens.space8,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        side: BorderSide(
          color: severityColor.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                color: severityColor,
                width: 4,
              ),
            ),
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          ),
          child: Padding(
            padding: const EdgeInsets.all(DesignTokens.space16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Severity + Time + Trend
                Row(
                  children: [
                    // Severity icon
                    Container(
                      padding: const EdgeInsets.all(DesignTokens.space8),
                      decoration: BoxDecoration(
                        color: severityColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                      ),
                      child: Icon(
                        incident.severity.icon,
                        color: severityColor,
                        size: 20,
                      ),
                    ),
                    
                    const SizedBox(width: DesignTokens.space12),
                    
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              // Severity badge
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: DesignTokens.space8,
                                  vertical: DesignTokens.space4,
                                ),
                                decoration: BoxDecoration(
                                  color: severityColor,
                                  borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                                ),
                                child: Text(
                                  incident.severity.displayName.toUpperCase(),
                                  style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                ),
                              ),
                              
                              const SizedBox(width: DesignTokens.space8),
                              
                              // State badge
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: DesignTokens.space8,
                                  vertical: DesignTokens.space4,
                                ),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                                  border: Border.all(
                                    color: Theme.of(context).colorScheme.outline,
                                  ),
                                ),
                                child: Text(
                                  incident.state.displayName.toUpperCase(),
                                  style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: 0.5,
                                      ),
                                ),
                              ),
                            ],
                          ),
                          
                          const SizedBox(height: DesignTokens.space4),
                          
                          // Elapsed time + trend
                          Row(
                            children: [
                              Icon(
                                Icons.schedule,
                                size: 14,
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                              const SizedBox(width: DesignTokens.space4),
                              Text(
                                'Ongoing for ${incident.elapsedTimeString}',
                                style: Theme.of(context).textTheme.bodySmall!.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              const SizedBox(width: DesignTokens.space8),
                              Icon(
                                incident.trend.icon,
                                size: 14,
                                color: _getTrendColor(incident.trend, isDark),
                              ),
                              const SizedBox(width: DesignTokens.space4),
                              Text(
                                incident.trend.displayName,
                                style: Theme.of(context).textTheme.bodySmall!.copyWith(
                                      color: _getTrendColor(incident.trend, isDark),
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: DesignTokens.space16),
                
                // Title (plain language)
                Text(
                  incident.title,
                  style: Theme.of(context).textTheme.titleMedium!.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                
                const SizedBox(height: DesignTokens.space8),
                
                // Description
                Text(
                  incident.description,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                
                // Low confidence warning
                if (showLowConfidenceWarning) ...[
                  const SizedBox(height: DesignTokens.space12),
                  Container(
                    padding: const EdgeInsets.all(DesignTokens.space12),
                    decoration: BoxDecoration(
                      color: dataConfidence!.getColorForTheme(isDark).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                      border: Border.all(
                        color: dataConfidence!.getColorForTheme(isDark).withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.warning_amber_outlined,
                          size: 18,
                          color: dataConfidence!.getColorForTheme(isDark),
                        ),
                        const SizedBox(width: DesignTokens.space8),
                        Expanded(
                          child: Text(
                            'Low confidence: possible sensor fault. Verify before acting.',
                            style: Theme.of(context).textTheme.bodySmall!.copyWith(
                                  color: dataConfidence!.getColorForTheme(isDark),
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                
                const SizedBox(height: DesignTokens.space16),
                
                // Metrics section
                if (incident.currentValue != null) ...[
                  Container(
                    padding: const EdgeInsets.all(DesignTokens.space12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CURRENT VALUE',
                                style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                              ),
                              const SizedBox(height: DesignTokens.space4),
                              Text(
                                '${incident.currentValue!.toStringAsFixed(1)} ${incident.metricUnit ?? ""}',
                                style: Theme.of(context).textTheme.titleLarge!.copyWith(
                                      color: severityColor,
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                            ],
                          ),
                        ),
                        if (incident.thresholdValue != null) ...[
                          const SizedBox(width: DesignTokens.space16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'THRESHOLD',
                                  style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                ),
                                const SizedBox(height: DesignTokens.space4),
                                Text(
                                  '${incident.thresholdValue!.toStringAsFixed(1)} ${incident.metricUnit ?? ""}',
                                  style: Theme.of(context).textTheme.titleLarge!.copyWith(
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (dataConfidence != null) ...[
                          const SizedBox(width: DesignTokens.space16),
                          DataConfidenceIndicator(
                            confidence: dataConfidence!,
                            lastUpdated: incident.lastUpdated,
                            compact: true,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: DesignTokens.space12),
                ],
                
                // Affected assets
                Row(
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 16,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: DesignTokens.space4),
                    Text(
                      '${incident.affectedDeviceIds.length} ${incident.affectedDeviceIds.length == 1 ? "device" : "devices"} affected',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(width: DesignTokens.space16),
                    Icon(
                      Icons.analytics_outlined,
                      size: 16,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: DesignTokens.space4),
                    Text(
                      'Confidence: ${incident.confidenceLevel}%',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
                
                // Recommended action
                if (incident.recommendedAction != null) ...[
                  const SizedBox(height: DesignTokens.space16),
                  Container(
                    padding: const EdgeInsets.all(DesignTokens.space12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                      border: Border.all(
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.lightbulb_outline,
                          size: 18,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: DesignTokens.space8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'RECOMMENDED ACTION',
                                style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                      color: Theme.of(context).colorScheme.primary,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                              ),
                              const SizedBox(height: DesignTokens.space4),
                              Text(
                                incident.recommendedAction!,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                
                // Actions (acknowledge / resolve)
                if (incident.state.requiresAttention || incident.state == IncidentState.acknowledged) ...[
                  const SizedBox(height: DesignTokens.space16),
                  Row(
                    children: [
                      if (incident.state.requiresAttention && onAcknowledge != null)
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: onAcknowledge,
                            icon: const Icon(Icons.check, size: 18),
                            label: const Text('Acknowledge'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: severityColor,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ),
                      if (incident.state == IncidentState.acknowledged && onResolve != null) ...[
                        const SizedBox(width: DesignTokens.space8),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: onResolve,
                            icon: const Icon(Icons.check_circle_outline, size: 18),
                            label: const Text('Mark Resolved'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _getTrendColor(IncidentTrend trend, bool isDark) {
    switch (trend) {
      case IncidentTrend.worsening:
        return isDark ? const Color(0xFFEF4444) : const Color(0xFFDC2626);
      case IncidentTrend.stable:
        return isDark ? const Color(0xFFFBBF24) : const Color(0xFFF59E0B);
      case IncidentTrend.improving:
        return isDark ? const Color(0xFF34D399) : const Color(0xFF10B981);
    }
  }
}
