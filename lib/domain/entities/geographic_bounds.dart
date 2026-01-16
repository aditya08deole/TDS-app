import 'package:latlong2/latlong.dart';

/// Admin-defined operational geographic boundary
/// Defines the monitored infrastructure area
class GeographicBounds {
  final String id;
  final String name; // e.g., "University Campus", "Industrial Zone A"
  final LatLng center;
  final double defaultZoom;
  final LatLng? northEast; // Bounding box corner
  final LatLng? southWest; // Bounding box corner
  final List<LatLng>? polygonBoundary; // Optional polygon definition
  final String? description;
  final DateTime createdAt;
  final String createdBy; // Admin username
  final DateTime? updatedAt;
  final String? updatedBy;

  const GeographicBounds({
    required this.id,
    required this.name,
    required this.center,
    this.defaultZoom = 15.0,
    this.northEast,
    this.southWest,
    this.polygonBoundary,
    this.description,
    required this.createdAt,
    required this.createdBy,
    this.updatedAt,
    this.updatedBy,
  });

  /// Check if a coordinate is within the defined bounds
  bool contains(LatLng point) {
    if (northEast != null && southWest != null) {
      return point.latitude <= northEast!.latitude &&
          point.latitude >= southWest!.latitude &&
          point.longitude <= northEast!.longitude &&
          point.longitude >= southWest!.longitude;
    }
    return true; // No bounds defined, allow all
  }

  GeographicBounds copyWith({
    String? id,
    String? name,
    LatLng? center,
    double? defaultZoom,
    LatLng? northEast,
    LatLng? southWest,
    List<LatLng>? polygonBoundary,
    String? description,
    DateTime? createdAt,
    String? createdBy,
    DateTime? updatedAt,
    String? updatedBy,
  }) {
    return GeographicBounds(
      id: id ?? this.id,
      name: name ?? this.name,
      center: center ?? this.center,
      defaultZoom: defaultZoom ?? this.defaultZoom,
      northEast: northEast ?? this.northEast,
      southWest: southWest ?? this.southWest,
      polygonBoundary: polygonBoundary ?? this.polygonBoundary,
      description: description ?? this.description,
      createdAt: createdAt ?? this.createdAt,
      createdBy: createdBy ?? this.createdBy,
      updatedAt: updatedAt ?? this.updatedAt,
      updatedBy: updatedBy ?? this.updatedBy,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'center': {
          'latitude': center.latitude,
          'longitude': center.longitude,
        },
        'defaultZoom': defaultZoom,
        'northEast': northEast != null
            ? {
                'latitude': northEast!.latitude,
                'longitude': northEast!.longitude,
              }
            : null,
        'southWest': southWest != null
            ? {
                'latitude': southWest!.latitude,
                'longitude': southWest!.longitude,
              }
            : null,
        'polygonBoundary': polygonBoundary
            ?.map((p) => {'latitude': p.latitude, 'longitude': p.longitude})
            .toList(),
        'description': description,
        'createdAt': createdAt.toIso8601String(),
        'createdBy': createdBy,
        'updatedAt': updatedAt?.toIso8601String(),
        'updatedBy': updatedBy,
      };

  factory GeographicBounds.fromJson(Map<String, dynamic> json) =>
      GeographicBounds(
        id: json['id'] as String,
        name: json['name'] as String,
        center: LatLng(
          json['center']['latitude'] as double,
          json['center']['longitude'] as double,
        ),
        defaultZoom: json['defaultZoom'] as double? ?? 15.0,
        northEast: json['northEast'] != null
            ? LatLng(
                json['northEast']['latitude'] as double,
                json['northEast']['longitude'] as double,
              )
            : null,
        southWest: json['southWest'] != null
            ? LatLng(
                json['southWest']['latitude'] as double,
                json['southWest']['longitude'] as double,
              )
            : null,
        polygonBoundary: (json['polygonBoundary'] as List<dynamic>?)
            ?.map((p) => LatLng(
                  p['latitude'] as double,
                  p['longitude'] as double,
                ))
            .toList(),
        description: json['description'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        createdBy: json['createdBy'] as String,
        updatedAt: json['updatedAt'] != null
            ? DateTime.parse(json['updatedAt'] as String)
            : null,
        updatedBy: json['updatedBy'] as String?,
      );
}
