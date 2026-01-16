import 'package:latlong2/latlong.dart';

/// Physical location entity representing a site, building, or zone
/// A location can contain multiple devices
class Location {
  final String id;
  final String name;
  final String? description;
  final LatLng coordinates;
  final String? zoneCode; // Site code, building ID, etc.
  final List<String> deviceIds; // References to devices at this location
  final DateTime createdAt;
  final String createdBy; // Admin username
  final DateTime? updatedAt;
  final String? updatedBy;
  final bool isActive;

  const Location({
    required this.id,
    required this.name,
    this.description,
    required this.coordinates,
    this.zoneCode,
    this.deviceIds = const [],
    required this.createdAt,
    required this.createdBy,
    this.updatedAt,
    this.updatedBy,
    this.isActive = true,
  });

  Location copyWith({
    String? id,
    String? name,
    String? description,
    LatLng? coordinates,
    String? zoneCode,
    List<String>? deviceIds,
    DateTime? createdAt,
    String? createdBy,
    DateTime? updatedAt,
    String? updatedBy,
    bool? isActive,
  }) {
    return Location(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      coordinates: coordinates ?? this.coordinates,
      zoneCode: zoneCode ?? this.zoneCode,
      deviceIds: deviceIds ?? this.deviceIds,
      createdAt: createdAt ?? this.createdAt,
      createdBy: createdBy ?? this.createdBy,
      updatedAt: updatedAt ?? this.updatedAt,
      updatedBy: updatedBy ?? this.updatedBy,
      isActive: isActive ?? this.isActive,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'coordinates': {
          'latitude': coordinates.latitude,
          'longitude': coordinates.longitude,
        },
        'zoneCode': zoneCode,
        'deviceIds': deviceIds,
        'createdAt': createdAt.toIso8601String(),
        'createdBy': createdBy,
        'updatedAt': updatedAt?.toIso8601String(),
        'updatedBy': updatedBy,
        'isActive': isActive,
      };

  factory Location.fromJson(Map<String, dynamic> json) => Location(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        coordinates: LatLng(
          json['coordinates']['latitude'] as double,
          json['coordinates']['longitude'] as double,
        ),
        zoneCode: json['zoneCode'] as String?,
        deviceIds: (json['deviceIds'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        createdAt: DateTime.parse(json['createdAt'] as String),
        createdBy: json['createdBy'] as String,
        updatedAt: json['updatedAt'] != null
            ? DateTime.parse(json['updatedAt'] as String)
            : null,
        updatedBy: json['updatedBy'] as String?,
        isActive: json['isActive'] as bool? ?? true,
      );
}
