import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/dashboard_state.dart';
import '../../domain/entities/incident.dart';
import '../../core/theme/design_tokens.dart';
import '../providers/dashboard_mode_provider.dart';
import '../widgets/emergency/incident_summary_panel.dart';

/// Emergency mode screen layout
/// Simplified, focused interface for critical situations
class EmergencyModeLayout extends ConsumerWidget {
  final Incident primaryIncident;
  final List<Incident> relatedIncidents;
  final Widget map;
  final VoidCallback? onAcknowledge;
  final VoidCallback? onExitMode;
  final VoidCallback? onViewDetails;

  const EmergencyModeLayout({
    super.key,
    required this.primaryIncident,
    this.relatedIncidents = const [],
    required this.map,
    this.onAcknowledge,
    this.onExitMode,
    this.onViewDetails,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardState = ref.watch(dashboardStateProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      color: dashboardState.mode.getBackgroundTint(isDark),
      child: Column(
        children: [
          // Dominant incident summary panel
          IncidentSummaryPanel(
            primaryIncident: primaryIncident,
            relatedIncidents: relatedIncidents,
            dashboardState: dashboardState,
            onAcknowledge: onAcknowledge,
            onExitEmergencyMode: onExitMode,
            onViewDetails: onViewDetails,
          ),
          
          // Map as primary alarm surface
          Expanded(
            child: Stack(
              children: [
                map,
                
                // Minimal controls overlay
                Positioned(
                  top: DesignTokens.space12,
                  left: DesignTokens.space12,
                  child: _buildMinimalControls(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMinimalControls(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withOpacity(0.9),
        borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.emergency,
            size: 16,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(width: DesignTokens.space8),
          Text(
            'EMERGENCY MODE',
            style: Theme.of(context).textTheme.labelSmall!.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                  color: Theme.of(context).colorScheme.error,
                ),
          ),
        ],
      ),
    );
  }
}

/// Mode transition overlay - shows when changing modes
class ModeTransitionOverlay extends StatelessWidget {
  final DashboardMode newMode;
  final VoidCallback onComplete;

  const ModeTransitionOverlay({
    super.key,
    required this.newMode,
    required this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 500),
      onEnd: onComplete,
      builder: (context, value, child) {
        return AnimatedOpacity(
          opacity: value < 0.5 ? value * 2 : 2 - value * 2,
          duration: const Duration(milliseconds: 100),
          child: Container(
            color: Colors.black.withOpacity(0.3),
            child: Center(
              child: Container(
                padding: const EdgeInsets.all(DesignTokens.space24),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      newMode.icon,
                      size: 48,
                      color: newMode == DashboardMode.emergency
                          ? Theme.of(context).colorScheme.error
                          : Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: DesignTokens.space16),
                    Text(
                      'Switching to ${newMode.displayName}',
                      style: Theme.of(context).textTheme.titleMedium!.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
