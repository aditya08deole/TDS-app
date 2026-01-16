/// Incident lifecycle state
/// Governs UI behavior and operator workflows
enum IncidentState {
  /// Just detected, not yet reviewed
  detected,
  
  /// Operator has acknowledged, investigation in progress
  acknowledged,
  
  /// Severity increased due to time or scope
  escalated,
  
  /// Problem improving but still present
  improving,
  
  /// Problem resolved, awaiting final confirmation
  resolved,
  
  /// Closed - historical record only
  closed;

  String get displayName {
    switch (this) {
      case IncidentState.detected:
        return 'Detected';
      case IncidentState.acknowledged:
        return 'Acknowledged';
      case IncidentState.escalated:
        return 'Escalated';
      case IncidentState.improving:
        return 'Improving';
      case IncidentState.resolved:
        return 'Resolved';
      case IncidentState.closed:
        return 'Closed';
    }
  }

  /// States requiring operator attention
  bool get isActive {
    return this == IncidentState.detected ||
        this == IncidentState.acknowledged ||
        this == IncidentState.escalated ||
        this == IncidentState.improving;
  }

  /// States that should trigger visual alerts
  bool get requiresAttention {
    return this == IncidentState.detected || this == IncidentState.escalated;
  }
}
