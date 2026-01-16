import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/entities/incident.dart';
import '../../../core/theme/design_tokens.dart';

/// Emergency-ready incident banner
/// Activates during critical conditions, provides at-a-glance status
/// Designed for 2AM readability and immediate decision support
class IncidentBanner extends ConsumerWidget {
  final Incident incident;
  final VoidCallback? onTap;
  final VoidCallback? onAcknowledge;

  const IncidentBanner({
    super.key,
    required this.incident,
    this.onTap,
    this.onAcknowledge,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final severityColor = incident.severity.getColorForTheme(isDark);
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(DesignTokens.space16),
        decoration: BoxDecoration(
          color: severityColor.withOpacity(0.12),
          border: Border(
            left: BorderSide(
              color: severityColor,
              width: 4,
            ),
            bottom: BorderSide(
              color: severityColor.withOpacity(0.3),
              width: 1,
            ),
          ),
        ),
        child: Row(
          children: [
            // Severity icon
            Container(
              padding: const EdgeInsets.all(DesignTokens.space8),
              decoration: BoxDecoration(
                color: severityColor.withOpacity(0.2),
                borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
              ),
              child: Icon(
                incident.severity.icon,
                color: severityColor,
                size: 24,
              ),
            ),
            
            const SizedBox(width: DesignTokens.space16),
            
            // Incident info
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
                      
                      // Elapsed time
                      Text(
                        incident.elapsedTimeString,
                        style: Theme.of(context).textTheme.bodySmall!.copyWith(
                              color: severityColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      
                      const SizedBox(width: DesignTokens.space8),
                      
                      // Trend indicator
                      Icon(
                        incident.trend.icon,
                        size: 16,
                        color: _getTrendColor(incident.trend, isDark),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: DesignTokens.space8),
                  
                  // Incident title (plain language)
                  Text(
                    incident.title,
                    style: Theme.of(context).textTheme.titleMedium!.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  
                  const SizedBox(height: DesignTokens.space4),
                  
                  // Affected devices count
                  Text(
                    '${incident.affectedDeviceIds.length} ${incident.affectedDeviceIds.length == 1 ? "device" : "devices"} affected',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            
            // Acknowledge button (if not acknowledged)
            if (!incident.state.requiresAttention && onAcknowledge != null)
              const SizedBox(width: DesignTokens.space12),
            
            if (incident.state.requiresAttention && onAcknowledge != null)
              ElevatedButton.icon(
                onPressed: onAcknowledge,
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Acknowledge'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: severityColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: DesignTokens.space16,
                    vertical: DesignTokens.space12,
                  ),
                ),
              ),
            
            const SizedBox(width: DesignTokens.space8),
            
            // Navigate arrow
            Icon(
              Icons.arrow_forward_ios,
              size: 16,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ],
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
