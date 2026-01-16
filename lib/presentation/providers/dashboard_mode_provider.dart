import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/dashboard_state.dart';
import '../../domain/entities/incident.dart';
import '../../data/services/dashboard_mode_service.dart';

/// Dashboard mode service provider
final dashboardModeServiceProvider = Provider<DashboardModeService>((ref) {
  return DashboardModeService();
});

/// Current dashboard state provider
final dashboardStateProvider = StateNotifierProvider<DashboardStateNotifier, DashboardState>((ref) {
  return DashboardStateNotifier(ref.watch(dashboardModeServiceProvider));
});

/// Dashboard state notifier
class DashboardStateNotifier extends StateNotifier<DashboardState> {
  final DashboardModeService _service;

  DashboardStateNotifier(this._service)
      : super(const DashboardState(mode: DashboardMode.normal));

  /// Evaluate mode transition based on incidents
  void evaluateTransition(List<Incident> activeIncidents) {
    final newState = _service.evaluateModeTransition(
      currentState: state,
      activeIncidents: activeIncidents,
    );
    if (newState != null) {
      state = newState;
    }
  }

  /// Manually activate emergency mode
  void activateEmergencyMode({
    required String incidentId,
    required String activatedBy,
    required String userRole,
  }) {
    final result = _service.activateEmergencyMode(
      incidentId: incidentId,
      activatedBy: activatedBy,
      userRole: userRole,
    );
    state = result.state;
    // TODO: Log audit entry
  }

  /// Manually deactivate emergency mode
  void deactivateEmergencyMode({
    required String deactivatedBy,
    required String userRole,
    required String reason,
  }) {
    final result = _service.deactivateEmergencyMode(
      currentState: state,
      deactivatedBy: deactivatedBy,
      userRole: userRole,
      reason: reason,
    );
    state = result.state;
    // TODO: Log audit entry
  }

  /// Get operator guidance for current mode
  String get modeGuidance => _service.getModeGuidance(state.mode);

  /// Get transition actions
  List<String> get transitionActions => _service.getTransitionActions(state.mode);
}

/// Whether currently in emergency mode
final isEmergencyModeProvider = Provider<bool>((ref) {
  return ref.watch(dashboardStateProvider).mode == DashboardMode.emergency;
});

/// Whether non-essential UI should be hidden
final hideNonEssentialProvider = Provider<bool>((ref) {
  return ref.watch(dashboardStateProvider).mode.hideNonEssential;
});
