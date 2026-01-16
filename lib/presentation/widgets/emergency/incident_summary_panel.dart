import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/entities/incident.dart';
import '../../../domain/entities/dashboard_state.dart';
import '../../../core/theme/design_tokens.dart';

/// Emergency mode incident summary panel
/// Dominates top of screen during critical situations
/// Designed for 2AM readability and zero-navigation clarity
class IncidentSummaryPanel extends ConsumerWidget {
  final Incident primaryIncident;
  final List<Incident> relatedIncidents;
  final DashboardState dashboardState;
  final VoidCallback? onAcknowledge;
  final VoidCallback? onExitEmergencyMode;
  final VoidCallback? onViewDetails;

  const IncidentSummaryPanel({
    super.key,
    required this.primaryIncident,
    this.relatedIncidents = const [],
    required this.dashboardState,
    this.onAcknowledge,
    this.onExitEmergencyMode,
    this.onViewDetails,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final severityColor = primaryIncident.severity.getColorForTheme(isDark);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: severityColor.withOpacity(0.08),
        border: Border(
          bottom: BorderSide(
            color: severityColor.withOpacity(0.3),
            width: 2,
          ),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.all(DesignTokens.space20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Mode indicator + Exit button
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DesignTokens.space12,
                      vertical: DesignTokens.space6,
                    ),
                    decoration: BoxDecoration(
                      color: severityColor,
                      borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          dashboardState.mode.icon,
                          color: Colors.white,
                          size: 16,
                        ),
                        const SizedBox(width: DesignTokens.space6),
                        Text(
                          dashboardState.mode.displayName.toUpperCase(),
                          style: Theme.of(context).textTheme.labelMedium!.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0,
                              ),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(width: DesignTokens.space12),
                  
                  if (dashboardState.timeInMode != null)
                    Text(
                      'Active for ${_formatDuration(dashboardState.timeInMode!)}',
                      style: Theme.of(context).textTheme.bodySmall!.copyWith(
                            color: severityColor,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  
                  const Spacer(),
                  
                  if (onExitEmergencyMode != null)
                    TextButton.icon(
                      onPressed: onExitEmergencyMode,
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text('Exit Emergency Mode'),
                      style: TextButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                ],
              ),
              
              const SizedBox(height: DesignTokens.space20),
              
              // Primary incident summary
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Severity icon (large)
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: severityColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
                    ),
                    child: Icon(
                      primaryIncident.severity.icon,
                      color: severityColor,
                      size: 32,
                    ),
                  ),
                  
                  const SizedBox(width: DesignTokens.space16),
                  
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // What is wrong (plain language)
                        Text(
                          primaryIncident.title,
                          style: Theme.of(context).textTheme.headlineSmall!.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        
                        const SizedBox(height: DesignTokens.space8),
                        
                        // Where + When
                        Row(
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 18,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: DesignTokens.space4),
                            Text(
                              '${primaryIncident.affectedLocationIds.length} ${primaryIncident.affectedLocationIds.length == 1 ? "location" : "locations"}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(width: DesignTokens.space16),
                            Icon(
                              Icons.schedule,
                              size: 18,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: DesignTokens.space4),
                            Text(
                              'Started ${primaryIncident.elapsedTimeString}',
                              style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            const SizedBox(width: DesignTokens.space16),
                            Icon(
                              primaryIncident.trend.icon,
                              size: 18,
                              color: _getTrendColor(primaryIncident.trend, isDark),
                            ),
                            const SizedBox(width: DesignTokens.space4),
                            Text(
                              primaryIncident.trend.displayName,
                              style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                                    color: _getTrendColor(primaryIncident.trend, isDark),
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ],
                        ),
                        
                        const SizedBox(height: DesignTokens.space12),
                        
                        // What this means (context)
                        Container(
                          padding: const EdgeInsets.all(DesignTokens.space12),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.info_outline,
                                    size: 16,
                                    color: Theme.of(context).colorScheme.primary,
                                  ),
                                  const SizedBox(width: DesignTokens.space6),
                                  Text(
                                    'WHAT THIS MEANS',
                                    style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 0.5,
                                        ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: DesignTokens.space6),
                              Text(
                                primaryIncident.description,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: DesignTokens.space12),
                        
                        // Suggested next steps
                        if (primaryIncident.recommendedAction != null)
                          Container(
                            padding: const EdgeInsets.all(DesignTokens.space12),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                              border: Border.all(
                                color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.checklist_outlined,
                                      size: 16,
                                      color: Theme.of(context).colorScheme.primary,
                                    ),
                                    const SizedBox(width: DesignTokens.space6),
                                    Text(
                                      'SUGGESTED NEXT STEPS',
                                      style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                            color: Theme.of(context).colorScheme.primary,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 0.5,
                                          ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: DesignTokens.space6),
                                Text(
                                  primaryIncident.recommendedAction!,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              
              // Related incidents warning
              if (relatedIncidents.isNotEmpty) ...[
                const SizedBox(height: DesignTokens.space16),
                Container(
                  padding: const EdgeInsets.all(DesignTokens.space12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.errorContainer.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.error.withOpacity(0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.warning_amber_outlined,
                        size: 18,
                        color: Theme.of(context).colorScheme.error,
                      ),
                      const SizedBox(width: DesignTokens.space8),
                      Text(
                        '${relatedIncidents.length} additional ${relatedIncidents.length == 1 ? "incident" : "incidents"} active',
                        style: Theme.of(context).textTheme.bodySmall!.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
              
              // Action buttons
              const SizedBox(height: DesignTokens.space16),
              Row(
                children: [
                  if (primaryIncident.state.requiresAttention && onAcknowledge != null)
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onAcknowledge,
                        icon: const Icon(Icons.check_circle_outline),
                        label: const Text('Acknowledge Incident'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: severityColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            vertical: DesignTokens.space14,
                          ),
                        ),
                      ),
                    ),
                  
                  if (onViewDetails != null) ...[
                    const SizedBox(width: DesignTokens.space12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onViewDetails,
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('View Full Details'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            vertical: DesignTokens.space14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    if (duration.inMinutes < 60) {
      return '${duration.inMinutes} min';
    } else if (duration.inHours < 24) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    }
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
