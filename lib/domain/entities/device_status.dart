/// Device status enumeration
enum DeviceStatus {
  online,
  offline,
  warning,
  critical;

  String get displayName {
    switch (this) {
      case DeviceStatus.online:
        return 'Online';
      case DeviceStatus.offline:
        return 'Offline';
      case DeviceStatus.warning:
        return 'Warning';
      case DeviceStatus.critical:
        return 'Critical';
    }
  }
}
