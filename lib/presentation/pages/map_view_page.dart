import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:fl_chart/fl_chart.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/app_color_system.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/design_tokens.dart';
import '../../core/constants/app_constants.dart';
import '../../domain/entities/tds_device.dart';
import '../../domain/entities/device_status.dart';
import '../widgets/glass_card.dart';
import '../widgets/status_indicator.dart';
import '../widgets/theme_toggle.dart';
import '../widgets/desktop/desktop_components.dart';
import '../providers/app_providers.dart';
import 'package:intl/intl.dart';

/// Map view page with OpenStreetMap integration - Responsive for Desktop
class MapViewPage extends ConsumerStatefulWidget {
  const MapViewPage({super.key});

  @override
  ConsumerState<MapViewPage> createState() => _MapViewPageState();
}

class _MapViewPageState extends ConsumerState<MapViewPage> {
  TDSDevice? _selectedDevice;
  final MapController _mapController = MapController();

  @override
  Widget build(BuildContext context) {
    final devicesAsync = ref.watch(devicesProvider);
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: devicesAsync.when(
          data: (devices) => isDesktop
              ? _buildDesktopLayout(context, devices)
              : _buildMobileLayout(context, devices),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => Center(child: Text('Error: $error')),
        ),
      ),
    );
  }

  /// Desktop layout with side panel
  Widget _buildDesktopLayout(BuildContext context, List<TDSDevice> devices) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        // Left panel - Device list
        Container(
          width: 360,
          decoration: BoxDecoration(
            color: colorScheme.surface,
            border: Border(
              right: BorderSide(
                color: colorScheme.outlineVariant.withOpacity(0.5),
              ),
            ),
          ),
          child: Column(
            children: [
              // Search bar
              Padding(
                padding: const EdgeInsets.all(DesignTokens.space16),
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Search devices...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: colorScheme.surfaceContainerHighest.withOpacity(0.5),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                ),
              ),
              // Stats summary
              _buildStatsSummary(context, devices),
              const SizedBox(height: DesignTokens.space8),
              // Device list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: DesignTokens.space16),
                  itemCount: devices.length,
                  itemBuilder: (context, index) {
                    final device = devices[index];
                    return _buildDesktopDeviceListItem(context, device);
                  },
                ),
              ),
            ],
          ),
        ),
        // Map area
        Expanded(
          child: Stack(
            children: [
              _buildMap(devices),
              // Selected device card
              if (_selectedDevice != null)
                Positioned(
                  top: DesignTokens.space16,
                  right: DesignTokens.space16,
                  width: 320,
                  child: _buildDesktopDeviceInfoCard(_selectedDevice!),
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// Mobile layout with overlay
  Widget _buildMobileLayout(BuildContext context, List<TDSDevice> devices) {
    return Stack(
      children: [
        _buildMap(devices),
        // Header
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: _buildHeader(),
        ),
        // Device Info Card
        if (_selectedDevice != null)
          Positioned(
            bottom: 20,
            left: 20,
            right: 20,
            child: _buildDeviceInfoCard(_selectedDevice!),
          ),
      ],
    );
  }

  Widget _buildStatsSummary(BuildContext context, List<TDSDevice> devices) {
    final colorScheme = Theme.of(context).colorScheme;
    final onlineCount = devices.where((d) => d.status == DeviceStatus.online).length;
    final warningCount = devices.where((d) => d.status == DeviceStatus.warning).length;
    final criticalCount = devices.where((d) => d.status == DeviceStatus.critical).length;
    final offlineCount = devices.where((d) => d.status == DeviceStatus.offline).length;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: DesignTokens.space16),
      padding: const EdgeInsets.all(DesignTokens.space12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      ),
      child: Row(
        children: [
          _buildMiniStat(context, onlineCount, 'Online', AppColorSystem.successLight),
          _buildMiniStat(context, warningCount, 'Warning', AppColorSystem.warningLight),
          _buildMiniStat(context, criticalCount, 'Critical', AppColorSystem.criticalLight),
          _buildMiniStat(context, offlineCount, 'Offline', AppColorSystem.infoLight),
        ],
      ),
    );
  }

  Widget _buildMiniStat(BuildContext context, int count, String label, Color color) {
    return Expanded(
      child: Column(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            count.toString(),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopDeviceListItem(BuildContext context, TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;
    final isSelected = _selectedDevice?.id == device.id;

    return Container(
      margin: const EdgeInsets.only(bottom: DesignTokens.space8),
      child: Material(
        color: isSelected
            ? colorScheme.primary.withOpacity(0.1)
            : colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        child: InkWell(
          onTap: () {
            setState(() => _selectedDevice = device);
            _mapController.move(device.coordinates, AppConstants.defaultZoom);
          },
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          child: Padding(
            padding: const EdgeInsets.all(DesignTokens.space12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _getMarkerColor(device.status).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                  ),
                  child: Icon(
                    Icons.water_drop,
                    color: _getMarkerColor(device.status),
                    size: 20,
                  ),
                ),
                const SizedBox(width: DesignTokens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.name,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        device.location,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${device.currentTDS.toStringAsFixed(0)} ppm',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: colorScheme.primary,
                      ),
                    ),
                    StatusIndicator(status: device.status, showLabel: false, size: 8),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDesktopDeviceInfoCard(TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(DesignTokens.space16),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(DesignTokens.radiusLg),
                topRight: Radius.circular(DesignTokens.radiusLg),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _getMarkerColor(device.status).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.water_drop,
                    color: _getMarkerColor(device.status),
                    size: 20,
                  ),
                ),
                const SizedBox(width: DesignTokens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Row(
                        children: [
                          Icon(
                            Icons.location_on,
                            size: 12,
                            color: colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              device.location,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => setState(() => _selectedDevice = null),
                  icon: const Icon(Icons.close, size: 20),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(DesignTokens.space16),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _buildDesktopInfoTile(
                        context,
                        'TDS Level',
                        '${device.currentTDS.toStringAsFixed(1)} ppm',
                        Icons.water_drop_outlined,
                      ),
                    ),
                    const SizedBox(width: DesignTokens.space12),
                    Expanded(
                      child: _buildDesktopInfoTile(
                        context,
                        'Temperature',
                        device.temperature != null
                            ? '${device.temperature!.toStringAsFixed(1)}°C'
                            : 'N/A',
                        Icons.thermostat_outlined,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: DesignTokens.space16),
                // Glass-style mini chart
                _buildDeviceChart(device),
                const SizedBox(height: DesignTokens.space12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    StatusIndicator(status: device.status, showLabel: true),
                    Text(
                      'Updated: ${DateFormat('HH:mm:ss').format(device.lastUpdated)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceChart(TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Generate mock historical data for this device
    final random = math.Random(device.id.hashCode);
    final baseValue = device.currentTDS;
    final spots = List.generate(12, (i) {
      final variance = (random.nextDouble() - 0.5) * 100;
      return FlSpot(i.toDouble(), (baseValue + variance).clamp(50, 800));
    });
    
    return ClipRRect(
      borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          height: 100,
          padding: const EdgeInsets.all(DesignTokens.space12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      AppColors.glassLight,
                      AppColors.glassDark,
                    ]
                  : [
                      colorScheme.surfaceContainerHighest.withOpacity(0.5),
                      colorScheme.surfaceContainerHighest.withOpacity(0.2),
                    ],
            ),
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
            border: Border.all(
              color: isDark 
                  ? AppColors.glassMedium 
                  : colorScheme.outlineVariant.withOpacity(0.3),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TDS History (24h)',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              Expanded(
                child: LineChart(
                  LineChartData(
                    gridData: FlGridData(show: false),
                    titlesData: FlTitlesData(show: false),
                    borderData: FlBorderData(show: false),
                    lineBarsData: [
                      LineChartBarData(
                        spots: spots,
                        isCurved: true,
                        color: _getMarkerColor(device.status),
                        barWidth: 2,
                        isStrokeCapRound: true,
                        dotData: FlDotData(show: false),
                        belowBarData: BarAreaData(
                          show: true,
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              _getMarkerColor(device.status).withOpacity(0.3),
                              _getMarkerColor(device.status).withOpacity(0.05),
                            ],
                          ),
                        ),
                      ),
                    ],
                    lineTouchData: LineTouchData(enabled: false),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDesktopInfoTile(BuildContext context, String label, String value, IconData icon) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(DesignTokens.space12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      ),
      child: Column(
        children: [
          Icon(icon, color: colorScheme.primary, size: 20),
          const SizedBox(height: DesignTokens.space8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Color _getMarkerColor(DeviceStatus status) {
    switch (status) {
      case DeviceStatus.online:
        return AppColorSystem.successLight;
      case DeviceStatus.warning:
        return AppColorSystem.warningLight;
      case DeviceStatus.critical:
        return AppColorSystem.criticalLight;
      case DeviceStatus.offline:
        return AppColorSystem.infoLight;
    }
  }

  Widget _buildHeader() {
    final user = ref.watch(currentUserProvider).value;
    final colorScheme = Theme.of(context).colorScheme;
    
    return Padding(
      padding: const EdgeInsets.all(DesignTokens.space16),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(
          horizontal: DesignTokens.space20,
          vertical: DesignTokens.space16,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(DesignTokens.space8),
              decoration: BoxDecoration(
                color: colorScheme.primary,
                borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
              ),
              child: Icon(
                Icons.map,
                color: colorScheme.onPrimary,
                size: 20,
              ),
            ),
            const SizedBox(width: DesignTokens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Device Map',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Row(
                    children: [
                      Text(
                        user?.username ?? 'User',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(width: DesignTokens.space4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: DesignTokens.space8,
                          vertical: DesignTokens.space2,
                        ),
                        decoration: BoxDecoration(
                          color: user?.isAdmin == true
                              ? AppColorSystem.adminLight
                              : AppColorSystem.userLight,
                          borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                        ),
                        child: Text(
                          user?.role.displayName ?? '',
                          style: Theme.of(context).textTheme.labelSmall!.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const ThemeToggleButton(),
            const SizedBox(width: DesignTokens.space8),
            IconButton(
              onPressed: () async {
                await ref.read(currentUserProvider.notifier).logout();
                if (mounted) {
                  Navigator.of(context).pushReplacementNamed('/');
                }
              },
              icon: Icon(Icons.logout, color: colorScheme.error),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMap(List<TDSDevice> devices) {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: const LatLng(
          AppConstants.defaultLatitude,
          AppConstants.defaultLongitude,
        ),
        initialZoom: AppConstants.defaultZoom,
        minZoom: AppConstants.minZoom,
        maxZoom: AppConstants.maxZoom,
        onTap: (_, __) => setState(() => _selectedDevice = null),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.evaratds.app',
        ),
        // IIITH Campus boundary - Neon circle
        CircleLayer(
          circles: [
            // Outer glow effect
            CircleMarker(
              point: const LatLng(17.4450, 78.3483), // IIITH campus center
              radius: 520, // ~520 meters radius to cover campus
              useRadiusInMeter: true,
              color: AppColors.primaryCyan.withOpacity(0.05),
              borderColor: AppColors.primaryCyan.withOpacity(0.15),
              borderStrokeWidth: 8,
            ),
            // Middle glow
            CircleMarker(
              point: const LatLng(17.4450, 78.3483),
              radius: 500,
              useRadiusInMeter: true,
              color: Colors.transparent,
              borderColor: AppColors.primaryCyan.withOpacity(0.3),
              borderStrokeWidth: 4,
            ),
            // Inner neon border
            CircleMarker(
              point: const LatLng(17.4450, 78.3483),
              radius: 490,
              useRadiusInMeter: true,
              color: Colors.transparent,
              borderColor: AppColors.primaryCyan.withOpacity(0.6),
              borderStrokeWidth: 2,
            ),
          ],
        ),
        // Campus label
        MarkerLayer(
          markers: [
            Marker(
              point: const LatLng(17.4495, 78.3483), // Top of campus
              width: 200,
              height: 30,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(
                    color: AppColors.primaryCyan.withOpacity(0.5),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryCyan.withOpacity(0.3),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: const Text(
                  'IIIT Hyderabad Campus',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.primaryCyan,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
        ),
        // Device markers
        MarkerLayer(
          markers: devices.map((device) => _buildMarker(device)).toList(),
        ),
      ],
    );
  }

  Marker _buildMarker(TDSDevice device) {
    Color markerColor;
    switch (device.status) {
      case DeviceStatus.online:
        markerColor = AppColorSystem.successLight;
        break;
      case DeviceStatus.warning:
        markerColor = AppColorSystem.warningLight;
        break;
      case DeviceStatus.critical:
        markerColor = AppColorSystem.criticalLight;
        break;
      case DeviceStatus.offline:
        markerColor = AppColorSystem.infoLight;
        break;
    }

    return Marker(
      point: device.coordinates,
      width: 60,
      height: 70,
      child: GestureDetector(
        onTap: () {
          setState(() => _selectedDevice = device);
          _mapController.move(device.coordinates, AppConstants.defaultZoom);
        },
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: markerColor,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: markerColor.withOpacity(0.4),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ],
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _getDeviceIcon(device.name),
                    color: Colors.white,
                    size: 20,
                  ),
                  Text(
                    device.currentTDS.toStringAsFixed(0),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            // Pointer triangle
            CustomPaint(
              size: const Size(12, 8),
              painter: _TrianglePainter(color: markerColor),
            ),
          ],
        ),
      ),
    );
  }
  
  IconData _getDeviceIcon(String deviceName) {
    final name = deviceName.toLowerCase();
    if (name.contains('mess') || name.contains('canteen') || name.contains('food')) {
      return Icons.restaurant;
    } else if (name.contains('hostel') || name.contains('obh') || name.contains('nbh') || name.contains('girls')) {
      return Icons.bed;
    } else if (name.contains('library')) {
      return Icons.menu_book;
    } else if (name.contains('sports') || name.contains('athletic')) {
      return Icons.sports_soccer;
    } else if (name.contains('research') || name.contains('krb') || name.contains('hub')) {
      return Icons.science;
    }
    return Icons.water_drop;
  }

  Widget _buildDeviceInfoCard(TDSDevice device) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device.name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          size: 14,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            device.location,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => setState(() => _selectedDevice = null),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildInfoTile(
                  'TDS Level',
                  '${device.currentTDS.toStringAsFixed(1)} ppm',
                  Icons.water_drop_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildInfoTile(
                  'Temperature',
                  device.temperature != null
                      ? '${device.temperature!.toStringAsFixed(1)}°C'
                      : 'N/A',
                  Icons.thermostat_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('Status: '),
                  StatusIndicator(status: device.status, showLabel: true),
                ],
              ),
              Text(
                DateFormat('HH:mm:ss').format(device.lastUpdated),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile(String label, String value, IconData icon) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        children: [
          Icon(icon, color: colorScheme.primary, size: 20),
          const SizedBox(height: DesignTokens.space8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium!.copyWith(
                  color: colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

/// Triangle painter for map marker pointer
class _TrianglePainter extends CustomPainter {
  final Color color;
  
  _TrianglePainter({required this.color});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
