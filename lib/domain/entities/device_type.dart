import 'package:flutter/material.dart';

/// Device type classification for infrastructure monitoring
/// Determines marker appearance, icon, and specialized behavior
enum DeviceType {
  tank,
  borewell,
  pipeline,
  meter,
  reservoir,
  pumpStation,
  treatmentPlant,
  sensor;

  String get displayName {
    switch (this) {
      case DeviceType.tank:
        return 'Storage Tank';
      case DeviceType.borewell:
        return 'Borewell';
      case DeviceType.pipeline:
        return 'Pipeline Monitor';
      case DeviceType.meter:
        return 'Flow Meter';
      case DeviceType.reservoir:
        return 'Reservoir';
      case DeviceType.pumpStation:
        return 'Pump Station';
      case DeviceType.treatmentPlant:
        return 'Treatment Plant';
      case DeviceType.sensor:
        return 'Water Quality Sensor';
    }
  }

  IconData get icon {
    switch (this) {
      case DeviceType.tank:
        return Icons.water_drop_outlined;
      case DeviceType.borewell:
        return Icons.blur_circular;
      case DeviceType.pipeline:
        return Icons.linear_scale;
      case DeviceType.meter:
        return Icons.speed;
      case DeviceType.reservoir:
        return Icons.waves;
      case DeviceType.pumpStation:
        return Icons.build_circle_outlined;
      case DeviceType.treatmentPlant:
        return Icons.factory_outlined;
      case DeviceType.sensor:
        return Icons.sensors;
    }
  }

  /// Returns color based on device type (neutral, used with status overlay)
  Color get baseColor => const Color(0xFF64748B);
}
