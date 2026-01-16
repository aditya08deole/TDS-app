import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../domain/entities/incident.dart';
import '../../../domain/entities/tds_device.dart';
import '../../../core/theme/design_tokens.dart';

/// Emergency mode map overlay
/// Auto-focuses on affected locations, dims unaffected areas
class EmergencyMapOverlay extends StatelessWidget {
  final List<TDSDevice> affectedDevices;
  final List<TDSDevice> allDevices;
  final Incident? primaryIncident;
  final MapController mapController;
  final Function(TDSDevice)? onDeviceTap;

  const EmergencyMapOverlay({
    super.key,
    required this.affectedDevices,
    required this.allDevices,
    this.primaryIncident,
    required this.mapController,
    this.onDeviceTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Stack(
      children: [
        // Dim overlay for unaffected areas (subtle)
        if (affectedDevices.isNotEmpty)
          Positioned.fill(
            child: IgnorePointer(
              child: Container(
                color: (isDark ? Colors.black : Colors.white).withOpacity(0.3),
              ),
            ),
          ),
        
        // Map markers layer
        MarkerLayer(
          markers: _buildMarkers(context, isDark),
        ),
        
        // Auto-focus button
        Positioned(
          bottom: DesignTokens.space16,
          right: DesignTokens.space16,
          child: FloatingActionButton.small(
            heroTag: 'focusIncident',
            onPressed: _focusOnAffectedDevices,
            backgroundColor: Theme.of(context).colorScheme.primary,
            child: const Icon(Icons.center_focus_strong, color: Colors.white),
          ),
        ),
      ],
    );
  }

  List<Marker> _buildMarkers(BuildContext context, bool isDark) {
    final markers = <Marker>[];
    final affectedIds = affectedDevices.map((d) => d.id).toSet();
    
    // Unaffected devices (dimmed)
    for (final device in allDevices) {
      if (!affectedIds.contains(device.id)) {
        markers.add(_buildDimmedMarker(device, isDark));
      }
    }
    
    // Affected devices (emphasized with pulse)
    for (final device in affectedDevices) {
      markers.add(_buildEmergencyMarker(context, device, isDark));
    }
    
    return markers;
  }

  Marker _buildDimmedMarker(TDSDevice device, bool isDark) {
    return Marker(
      point: LatLng(device.coordinates.latitude, device.coordinates.longitude),
      width: 24,
      height: 24,
      child: Opacity(
        opacity: 0.3,
        child: Icon(
          device.deviceType.icon,
          size: 24,
          color: isDark ? Colors.grey : Colors.grey.shade600,
        ),
      ),
    );
  }

  Marker _buildEmergencyMarker(BuildContext context, TDSDevice device, bool isDark) {
    final severityColor = primaryIncident?.severity.getColorForTheme(isDark) 
        ?? const Color(0xFFEF4444);
    
    return Marker(
      point: LatLng(device.coordinates.latitude, device.coordinates.longitude),
      width: 48,
      height: 48,
      child: GestureDetector(
        onTap: () => onDeviceTap?.call(device),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Pulse ring (controlled, not aggressive)
            _PulseRing(color: severityColor),
            
            // Device icon
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: severityColor,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: severityColor.withOpacity(0.4),
                    blurRadius: 8,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Icon(
                device.deviceType.icon,
                size: 20,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _focusOnAffectedDevices() {
    if (affectedDevices.isEmpty) return;
    
    if (affectedDevices.length == 1) {
      mapController.move(
        LatLng(affectedDevices.first.coordinates.latitude, affectedDevices.first.coordinates.longitude),
        16.0,
      );
    } else {
      // Fit bounds to all affected devices
      final bounds = LatLngBounds.fromPoints(
        affectedDevices.map((d) => LatLng(d.coordinates.latitude, d.coordinates.longitude)).toList(),
      );
      mapController.fitCamera(
        CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(50)),
      );
    }
  }
}

/// Controlled pulse animation for emergency markers
class _PulseRing extends StatefulWidget {
  final Color color;

  const _PulseRing({required this.color});

  @override
  State<_PulseRing> createState() => _PulseRingState();
}

class _PulseRingState extends State<_PulseRing> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    
    _opacityAnimation = Tween<double>(begin: 0.6, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: widget.color.withOpacity(_opacityAnimation.value),
                width: 2,
              ),
            ),
          ),
        );
      },
    );
  }
}
