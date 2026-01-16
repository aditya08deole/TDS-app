/// Incident severity levels
enum IncidentSeverity {
  low,
  medium,
  high,
  critical;

  static IncidentSeverity fromString(String value) {
    switch (value.toLowerCase()) {
      case 'low':
        return IncidentSeverity.low;
      case 'medium':
        return IncidentSeverity.medium;
      case 'high':
        return IncidentSeverity.high;
      case 'critical':
        return IncidentSeverity.critical;
      default:
        return IncidentSeverity.medium;
    }
  }
}

/// Incident status
enum IncidentStatus {
  open,
  acknowledged,
  inProgress,
  resolved,
  closed;

  static IncidentStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'open':
        return IncidentStatus.open;
      case 'acknowledged':
        return IncidentStatus.acknowledged;
      case 'in_progress':
        return IncidentStatus.inProgress;
      case 'resolved':
        return IncidentStatus.resolved;
      case 'closed':
        return IncidentStatus.closed;
      default:
        return IncidentStatus.open;
    }
  }

  String get dbValue {
    switch (this) {
      case IncidentStatus.open:
        return 'open';
      case IncidentStatus.acknowledged:
        return 'acknowledged';
      case IncidentStatus.inProgress:
        return 'in_progress';
      case IncidentStatus.resolved:
        return 'resolved';
      case IncidentStatus.closed:
        return 'closed';
    }
  }

  String get displayName {
    switch (this) {
      case IncidentStatus.open:
        return 'Open';
      case IncidentStatus.acknowledged:
        return 'Acknowledged';
      case IncidentStatus.inProgress:
        return 'In Progress';
      case IncidentStatus.resolved:
        return 'Resolved';
      case IncidentStatus.closed:
        return 'Closed';
    }
  }
}

/// Incident type
enum IncidentType {
  highTds,
  lowTds,
  highTemp,
  lowTemp,
  deviceOffline,
  maintenance,
  other;

  static IncidentType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'high_tds':
        return IncidentType.highTds;
      case 'low_tds':
        return IncidentType.lowTds;
      case 'high_temp':
        return IncidentType.highTemp;
      case 'low_temp':
        return IncidentType.lowTemp;
      case 'device_offline':
        return IncidentType.deviceOffline;
      case 'maintenance':
        return IncidentType.maintenance;
      case 'other':
      default:
        return IncidentType.other;
    }
  }

  String get dbValue {
    switch (this) {
      case IncidentType.highTds:
        return 'high_tds';
      case IncidentType.lowTds:
        return 'low_tds';
      case IncidentType.highTemp:
        return 'high_temp';
      case IncidentType.lowTemp:
        return 'low_temp';
      case IncidentType.deviceOffline:
        return 'device_offline';
      case IncidentType.maintenance:
        return 'maintenance';
      case IncidentType.other:
        return 'other';
    }
  }

  String get displayName {
    switch (this) {
      case IncidentType.highTds:
        return 'High TDS';
      case IncidentType.lowTds:
        return 'Low TDS';
      case IncidentType.highTemp:
        return 'High Temperature';
      case IncidentType.lowTemp:
        return 'Low Temperature';
      case IncidentType.deviceOffline:
        return 'Device Offline';
      case IncidentType.maintenance:
        return 'Maintenance';
      case IncidentType.other:
        return 'Other';
    }
  }
}

/// Incident model matching Supabase incidents table
class IncidentModel {
  final String id;
  final String? deviceId;
  final IncidentType type;
  final IncidentSeverity severity;
  final String title;
  final String? description;
  final IncidentStatus status;
  final String? assignedTo;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime? resolvedAt;
  final DateTime updatedAt;

  const IncidentModel({
    required this.id,
    this.deviceId,
    required this.type,
    required this.severity,
    required this.title,
    this.description,
    required this.status,
    this.assignedTo,
    this.createdBy,
    required this.createdAt,
    this.resolvedAt,
    required this.updatedAt,
  });

  factory IncidentModel.fromJson(Map<String, dynamic> json) {
    return IncidentModel(
      id: json['id'] as String,
      deviceId: json['device_id'] as String?,
      type: IncidentType.fromString(json['type'] as String),
      severity: IncidentSeverity.fromString(json['severity'] as String),
      title: json['title'] as String,
      description: json['description'] as String?,
      status: IncidentStatus.fromString(json['status'] as String),
      assignedTo: json['assigned_to'] as String?,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      resolvedAt: json['resolved_at'] != null 
          ? DateTime.parse(json['resolved_at'] as String) 
          : null,
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'device_id': deviceId,
      'type': type.dbValue,
      'severity': severity.name,
      'title': title,
      'description': description,
      'status': status.dbValue,
      'assigned_to': assignedTo,
      'created_by': createdBy,
      'created_at': createdAt.toIso8601String(),
      'resolved_at': resolvedAt?.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Map<String, dynamic> toInsertJson() {
    return {
      'device_id': deviceId,
      'type': type.dbValue,
      'severity': severity.name,
      'title': title,
      'description': description,
      'status': status.dbValue,
      'assigned_to': assignedTo,
      'created_by': createdBy,
    };
  }

  IncidentModel copyWith({
    String? id,
    String? deviceId,
    IncidentType? type,
    IncidentSeverity? severity,
    String? title,
    String? description,
    IncidentStatus? status,
    String? assignedTo,
    String? createdBy,
    DateTime? createdAt,
    DateTime? resolvedAt,
    DateTime? updatedAt,
  }) {
    return IncidentModel(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      type: type ?? this.type,
      severity: severity ?? this.severity,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      assignedTo: assignedTo ?? this.assignedTo,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  bool get isOpen => status == IncidentStatus.open;
  bool get isResolved => status == IncidentStatus.resolved || status == IncidentStatus.closed;
  bool get isCritical => severity == IncidentSeverity.critical;
}
