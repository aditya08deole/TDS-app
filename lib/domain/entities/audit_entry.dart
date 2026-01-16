/// Audit log entry for accountability and regulatory compliance
/// Every significant action must be logged with attribution
class AuditEntry {
  final String id;
  final DateTime timestamp;
  final String performedBy; // User ID or username
  final String userRole; // 'Admin', 'User'
  final AuditActionType actionType;
  final String action; // Plain language: "Acknowledged incident", "Created device"
  final String? targetEntityType; // 'device', 'incident', 'user', 'location'
  final String? targetEntityId;
  final Map<String, dynamic>? before; // State before change
  final Map<String, dynamic>? after; // State after change
  final String? notes; // Operator-provided context
  final String? ipAddress;
  final bool isSystemAction; // Automated vs manual

  const AuditEntry({
    required this.id,
    required this.timestamp,
    required this.performedBy,
    required this.userRole,
    required this.actionType,
    required this.action,
    this.targetEntityType,
    this.targetEntityId,
    this.before,
    this.after,
    this.notes,
    this.ipAddress,
    this.isSystemAction = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp.toIso8601String(),
        'performedBy': performedBy,
        'userRole': userRole,
        'actionType': actionType.name,
        'action': action,
        'targetEntityType': targetEntityType,
        'targetEntityId': targetEntityId,
        'before': before,
        'after': after,
        'notes': notes,
        'ipAddress': ipAddress,
        'isSystemAction': isSystemAction,
      };

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
        id: json['id'] as String,
        timestamp: DateTime.parse(json['timestamp'] as String),
        performedBy: json['performedBy'] as String,
        userRole: json['userRole'] as String,
        actionType: AuditActionType.values.firstWhere(
          (e) => e.name == json['actionType'],
        ),
        action: json['action'] as String,
        targetEntityType: json['targetEntityType'] as String?,
        targetEntityId: json['targetEntityId'] as String?,
        before: json['before'] as Map<String, dynamic>?,
        after: json['after'] as Map<String, dynamic>?,
        notes: json['notes'] as String?,
        ipAddress: json['ipAddress'] as String?,
        isSystemAction: json['isSystemAction'] as bool? ?? false,
      );
}

/// Classification of auditable actions
enum AuditActionType {
  // Authentication
  login,
  logout,
  loginFailed,
  sessionExpired,

  // Device management
  deviceCreated,
  deviceUpdated,
  deviceDisabled,
  deviceEnabled,
  deviceDeleted,

  // Location management
  locationCreated,
  locationUpdated,
  locationDeleted,

  // Incident management
  incidentDetected,
  incidentAcknowledged,
  incidentEscalated,
  incidentResolved,
  incidentClosed,
  actionAdded,

  // Configuration
  thresholdChanged,
  boundsChanged,
  userPermissionsChanged,

  // System
  dataSourceValidated,
  systemStarted,
  systemShutdown;

  String get displayName {
    final words = name.split(RegExp(r'(?=[A-Z])'));
    return words.map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
  }
}
