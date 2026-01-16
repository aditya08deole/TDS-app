import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'dart:math' as math;
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/design_tokens.dart';
import '../../domain/entities/device_status.dart';
import '../../domain/entities/tds_device.dart';
import '../widgets/glass_card.dart';
import '../widgets/status_indicator.dart';
import '../widgets/desktop/desktop_components.dart';
import '../providers/app_providers.dart';
import 'package:intl/intl.dart';

/// Dashboard page with statistics and charts - Responsive for Desktop
class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  String? _selectedDeviceId;
  String _selectedTimeRange = '24h';

  @override
  Widget build(BuildContext context) {
    final devicesAsync = ref.watch(devicesProvider);
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: devicesAsync.when(
          data: (devices) {
            if (_selectedDeviceId == null && devices.isNotEmpty) {
              _selectedDeviceId = devices.first.id;
            }
            return isDesktop
                ? _buildDesktopDashboard(context, devices)
                : _buildMobileDashboard(context, devices);
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => Center(child: Text('Error: $error')),
        ),
      ),
    );
  }

  TDSDevice? _getSelectedDevice(List<TDSDevice> devices) {
    if (_selectedDeviceId == null) return devices.isNotEmpty ? devices.first : null;
    return devices.firstWhere((d) => d.id == _selectedDeviceId, orElse: () => devices.first);
  }

  Widget _buildDesktopDashboard(BuildContext context, List<TDSDevice> devices) {
    final onlineCount = devices.where((d) => d.status == DeviceStatus.online).length;
    final warningCount = devices.where((d) => d.status == DeviceStatus.warning).length;
    final criticalCount = devices.where((d) => d.status == DeviceStatus.critical).length;
    final offlineCount = devices.where((d) => d.status == DeviceStatus.offline).length;
    final selectedDevice = _getSelectedDevice(devices);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(DesignTokens.space24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats row
          Row(
            children: [
              Expanded(child: _buildDesktopStatCard(context, 'Online', onlineCount, Icons.check_circle_outline, AppColors.statusNormal)),
              const SizedBox(width: DesignTokens.space16),
              Expanded(child: _buildDesktopStatCard(context, 'Warning', warningCount, Icons.warning_amber_outlined, AppColors.statusWarning)),
              const SizedBox(width: DesignTokens.space16),
              Expanded(child: _buildDesktopStatCard(context, 'Critical', criticalCount, Icons.error_outline, AppColors.statusCritical)),
              const SizedBox(width: DesignTokens.space16),
              Expanded(child: _buildDesktopStatCard(context, 'Offline', offlineCount, Icons.offline_bolt_outlined, AppColors.statusOffline)),
            ],
          ),
          const SizedBox(height: DesignTokens.space24),

          // Current readings cards
          Text('Current Readings', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: DesignTokens.space16),
          _buildCurrentReadingsRow(context, devices),
          const SizedBox(height: DesignTokens.space24),

          // Charts row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    DesktopPanel(
                      title: 'TDS Trend',
                      subtitle: selectedDevice != null ? 'Readings for ${selectedDevice.name}' : 'Select a device',
                      icon: Icons.trending_up,
                      padding: const EdgeInsets.all(DesignTokens.space20),
                      actions: [_buildDeviceSelector(context, devices), const SizedBox(width: 16), _buildTimeFilterChips(context)],
                      child: SizedBox(
                        height: 220,
                        child: selectedDevice != null ? _buildDeviceTDSChart(context, selectedDevice) : const Center(child: Text('No device selected')),
                      ),
                    ),
                    const SizedBox(height: DesignTokens.space24),
                    DesktopPanel(
                      title: 'Temperature Trend',
                      subtitle: selectedDevice != null ? 'Temperature for ${selectedDevice.name}' : 'Select a device',
                      icon: Icons.thermostat,
                      padding: const EdgeInsets.all(DesignTokens.space20),
                      child: SizedBox(
                        height: 180,
                        child: selectedDevice != null ? _buildDeviceTempChart(context, selectedDevice) : const Center(child: Text('No device selected')),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: DesignTokens.space24),
              Expanded(
                flex: 2,
                child: Column(
                  children: [
                    DesktopPanel(
                      title: 'Status Distribution',
                      subtitle: 'Device status overview',
                      icon: Icons.pie_chart_outline,
                      padding: const EdgeInsets.all(DesignTokens.space20),
                      child: SizedBox(
                        height: 220,
                        child: Row(
                          children: [
                            Expanded(child: _buildPieChart(onlineCount, warningCount, criticalCount, offlineCount)),
                            _buildChartLegend(context, onlineCount, warningCount, criticalCount, offlineCount),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: DesignTokens.space24),
                    DesktopPanel(
                      title: 'Recent Activity',
                      subtitle: 'Latest device updates',
                      icon: Icons.history,
                      height: 250,
                      scrollable: true,
                      child: Column(children: devices.take(6).map((device) => _buildActivityItem(context, device)).toList()),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: DesignTokens.space24),
          DesktopPanel(
            title: 'All Devices',
            subtitle: '${devices.length} devices registered',
            icon: Icons.devices,
            padding: EdgeInsets.zero,
            child: _buildDeviceTable(context, devices),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentReadingsRow(BuildContext context, List<TDSDevice> devices) {
    final colorScheme = Theme.of(context).colorScheme;
    final displayDevices = devices.take(4).toList();
    
    return Row(
      children: displayDevices.map((device) {
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: device != displayDevices.last ? DesignTokens.space16 : 0),
            child: _buildReadingCard(context, device, colorScheme),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildReadingCard(BuildContext context, TDSDevice device, ColorScheme colorScheme) {
    final random = math.Random(device.id.hashCode);
    final spots = List.generate(12, (i) {
      final variance = (random.nextDouble() - 0.5) * 50;
      return FlSpot(i.toDouble(), (device.currentTDS + variance).clamp(50, 800));
    });
    
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
        border: Border.all(color: colorScheme.outlineVariant.withOpacity(0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: _getStatusColor(device.status).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.water_drop, color: _getStatusColor(device.status), size: 16),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(device.name, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
            ],
          ),
          const SizedBox(height: DesignTokens.space12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(device.currentTDS.toStringAsFixed(0), style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppColors.primaryCyan, fontWeight: FontWeight.bold)),
                    Text('ppm TDS', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${device.temperature?.toStringAsFixed(1) ?? '--'}°C', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: colorScheme.primary, fontWeight: FontWeight.w600)),
                  Text('Temp', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant)),
                ],
              ),
            ],
          ),
          const SizedBox(height: DesignTokens.space12),
          SizedBox(
            height: 40,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(show: false),
                titlesData: FlTitlesData(show: false),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots, isCurved: true, color: _getStatusColor(device.status), barWidth: 2,
                    dotData: FlDotData(show: false),
                    belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_getStatusColor(device.status).withOpacity(0.2), _getStatusColor(device.status).withOpacity(0.02)])),
                  ),
                ],
                lineTouchData: LineTouchData(enabled: false),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceSelector(BuildContext context, List<TDSDevice> devices) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: colorScheme.surfaceContainerHighest.withOpacity(0.5), borderRadius: BorderRadius.circular(8)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedDeviceId,
          hint: const Text('Select Device'),
          icon: const Icon(Icons.arrow_drop_down),
          style: Theme.of(context).textTheme.bodyMedium,
          items: devices.map((device) {
            return DropdownMenuItem<String>(
              value: device.id,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: _getStatusColor(device.status), shape: BoxShape.circle)),
                  const SizedBox(width: 8),
                  Text(device.name),
                ],
              ),
            );
          }).toList(),
          onChanged: (value) => setState(() => _selectedDeviceId = value),
        ),
      ),
    );
  }

  Widget _buildDeviceTDSChart(BuildContext context, TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;
    final random = math.Random(device.id.hashCode);
    final spots = List.generate(24, (i) {
      final variance = (random.nextDouble() - 0.5) * 150;
      final trendFactor = math.sin(i / 4) * 30;
      return FlSpot(i.toDouble(), (device.currentTDS + variance + trendFactor).clamp(50, 800));
    });
    
    return LineChart(
      LineChartData(
        gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: 100, getDrawingHorizontalLine: (value) => FlLine(color: colorScheme.outlineVariant.withOpacity(0.3), strokeWidth: 1)),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, interval: 4, getTitlesWidget: (value, meta) {
            if (value.toInt() % 4 == 0) return Padding(padding: const EdgeInsets.only(top: 8), child: Text('${value.toInt()}:00', style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 10)));
            return const SizedBox.shrink();
          })),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 45, interval: 100, getTitlesWidget: (value, meta) => Text('${value.toInt()}', style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 10)))),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        minY: 0, maxY: 600,
        lineBarsData: [
          LineChartBarData(spots: List.generate(24, (i) => FlSpot(i.toDouble(), 300)), isCurved: false, color: AppColors.statusWarning.withOpacity(0.5), barWidth: 1, dotData: FlDotData(show: false), dashArray: [5, 5]),
          LineChartBarData(
            spots: spots, isCurved: true, color: _getStatusColor(device.status), barWidth: 3,
            dotData: FlDotData(show: false),
            belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [_getStatusColor(device.status).withOpacity(0.2), _getStatusColor(device.status).withOpacity(0.02)])),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceTempChart(BuildContext context, TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;
    final random = math.Random(device.id.hashCode + 1000);
    final baseTemp = device.temperature ?? 24.0;
    final spots = List.generate(24, (i) {
      final variance = (random.nextDouble() - 0.5) * 3;
      final dailyCycle = math.sin((i - 6) * math.pi / 12) * 2;
      return FlSpot(i.toDouble(), (baseTemp + variance + dailyCycle).clamp(18, 35));
    });
    
    return LineChart(
      LineChartData(
        gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: 5, getDrawingHorizontalLine: (value) => FlLine(color: colorScheme.outlineVariant.withOpacity(0.3), strokeWidth: 1)),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30, interval: 6, getTitlesWidget: (value, meta) => Padding(padding: const EdgeInsets.only(top: 8), child: Text('${value.toInt()}:00', style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 10))))),
          leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, interval: 5, getTitlesWidget: (value, meta) => Text('${value.toInt()}°', style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 10)))),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        minY: 15, maxY: 35,
        lineBarsData: [
          LineChartBarData(
            spots: spots, isCurved: true, color: Colors.orange, barWidth: 2,
            dotData: FlDotData(show: false),
            belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.orange.withOpacity(0.2), Colors.orange.withOpacity(0.02)])),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileDashboard(BuildContext context, List<TDSDevice> devices) {
    final onlineCount = devices.where((d) => d.status == DeviceStatus.online).length;
    final warningCount = devices.where((d) => d.status == DeviceStatus.warning).length;
    final criticalCount = devices.where((d) => d.status == DeviceStatus.critical).length;
    final offlineCount = devices.where((d) => d.status == DeviceStatus.offline).length;
    final selectedDevice = _getSelectedDevice(devices);

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(gradient: LinearGradient(colors: AppColors.primaryGradient), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.dashboard, color: Colors.black, size: 20)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Dashboard', style: Theme.of(context).textTheme.titleLarge), Text('Real-time monitoring', style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary))])),
                  Text(DateFormat('HH:mm').format(DateTime.now()), style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.primaryCyan)),
                ],
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.4),
            delegate: SliverChildListDelegate([
              _buildStatCard(context, 'Online', onlineCount.toString(), Icons.check_circle_outline, AppColors.statusNormal),
              _buildStatCard(context, 'Warning', warningCount.toString(), Icons.warning_amber_outlined, AppColors.statusWarning),
              _buildStatCard(context, 'Critical', criticalCount.toString(), Icons.error_outline, AppColors.statusCritical),
              _buildStatCard(context, 'Offline', offlineCount.toString(), Icons.offline_bolt_outlined, AppColors.statusOffline),
            ]),
          ),
        ),
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16.0), child: _buildDeviceSelector(context, devices))),
        if (selectedDevice != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: GlassCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Text('TDS Trend', style: Theme.of(context).textTheme.titleMedium), const Spacer(), Text('${selectedDevice.currentTDS.toStringAsFixed(0)} ppm', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primaryCyan, fontWeight: FontWeight.bold))]),
                    const SizedBox(height: 20),
                    SizedBox(height: 180, child: _buildDeviceTDSChart(context, selectedDevice)),
                  ],
                ),
              ),
            ),
          ),
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(16.0), child: Text('All Devices', style: Theme.of(context).textTheme.titleMedium))),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(delegate: SliverChildBuilderDelegate((context, index) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _buildMobileDeviceCard(context, devices[index])), childCount: devices.length)),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 20)),
      ],
    );
  }

  Widget _buildDesktopStatCard(BuildContext context, String label, int value, IconData icon, Color color) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space20),
      decoration: BoxDecoration(color: colorScheme.surface, borderRadius: BorderRadius.circular(DesignTokens.radiusLg), border: Border.all(color: colorScheme.outlineVariant.withOpacity(0.5))),
      child: Row(
        children: [
          Container(padding: const EdgeInsets.all(DesignTokens.space12), decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(DesignTokens.radiusMd)), child: Icon(icon, color: color, size: 28)),
          const SizedBox(width: DesignTokens.space16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant)), const SizedBox(height: 4), Text(value.toString(), style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: color, fontWeight: FontWeight.bold))])),
        ],
      ),
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, IconData icon, Color color) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 28)),
          const SizedBox(height: 12),
          Text(value, style: Theme.of(context).textTheme.displaySmall!.copyWith(color: color)),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary)),
        ],
      ),
    );
  }

  Widget _buildChartLegend(BuildContext context, int online, int warning, int critical, int offline) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLegendItem(context, 'Online', online, AppColors.statusNormal),
        const SizedBox(height: DesignTokens.space12),
        _buildLegendItem(context, 'Warning', warning, AppColors.statusWarning),
        const SizedBox(height: DesignTokens.space12),
        _buildLegendItem(context, 'Critical', critical, AppColors.statusCritical),
        const SizedBox(height: DesignTokens.space12),
        _buildLegendItem(context, 'Offline', offline, AppColors.statusOffline),
      ],
    );
  }

  Widget _buildLegendItem(BuildContext context, String label, int count, Color color) {
    return Row(children: [Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))), const SizedBox(width: DesignTokens.space8), Text('$label: $count', style: Theme.of(context).textTheme.bodyMedium)]);
  }

  Widget _buildTimeFilterChips(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: ['24h', '7d', '30d'].map((filter) {
        final isSelected = filter == _selectedTimeRange;
        return Padding(
          padding: const EdgeInsets.only(left: 8),
          child: FilterChip(label: Text(filter), selected: isSelected, onSelected: (_) => setState(() => _selectedTimeRange = filter), selectedColor: colorScheme.primary.withOpacity(0.2), checkmarkColor: colorScheme.primary, labelStyle: TextStyle(color: isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant, fontSize: 12), padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
        );
      }).toList(),
    );
  }

  Widget _buildActivityItem(BuildContext context, TDSDevice device) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: DesignTokens.space12, horizontal: DesignTokens.space16),
      margin: const EdgeInsets.only(bottom: DesignTokens.space8),
      decoration: BoxDecoration(color: colorScheme.surfaceContainerHighest.withOpacity(0.3), borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
      child: Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: _getStatusColor(device.status), shape: BoxShape.circle)),
          const SizedBox(width: DesignTokens.space12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(device.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)), Text('${device.currentTDS.toStringAsFixed(1)} ppm', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant))])),
          Text(DateFormat('HH:mm').format(device.lastUpdated), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }

  Widget _buildDeviceTable(BuildContext context, List<TDSDevice> devices) {
    final colorScheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStateProperty.all(colorScheme.surfaceContainerHighest.withOpacity(0.5)),
        columns: const [DataColumn(label: Text('Device')), DataColumn(label: Text('Location')), DataColumn(label: Text('TDS (ppm)'), numeric: true), DataColumn(label: Text('Temp (°C)'), numeric: true), DataColumn(label: Text('Status')), DataColumn(label: Text('Last Updated'))],
        rows: devices.map((device) {
          final isSelected = device.id == _selectedDeviceId;
          return DataRow(
            selected: isSelected,
            onSelectChanged: (_) => setState(() => _selectedDeviceId = device.id),
            cells: [
              DataCell(Row(children: [Container(width: 36, height: 36, decoration: BoxDecoration(color: _getStatusColor(device.status).withOpacity(0.15), borderRadius: BorderRadius.circular(8)), child: Icon(Icons.water_drop, color: _getStatusColor(device.status), size: 18)), const SizedBox(width: 12), Text(device.name)])),
              DataCell(Text(device.location)),
              DataCell(Text(device.currentTDS.toStringAsFixed(1), style: TextStyle(color: AppColors.primaryCyan, fontWeight: FontWeight.w600))),
              DataCell(Text(device.temperature?.toStringAsFixed(1) ?? '--', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w500))),
              DataCell(StatusIndicator(status: device.status, showLabel: true, size: 8)),
              DataCell(Text(DateFormat('MMM d, HH:mm').format(device.lastUpdated))),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMobileDeviceCard(BuildContext context, TDSDevice device) {
    final isSelected = device.id == _selectedDeviceId;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      onTap: () => setState(() => _selectedDeviceId = device.id),
      border: isSelected ? Border.all(color: AppColors.primaryCyan, width: 2) : null,
      child: Row(
        children: [
          Container(width: 50, height: 50, decoration: BoxDecoration(color: _getStatusColor(device.status).withOpacity(0.2), borderRadius: BorderRadius.circular(10)), child: Icon(Icons.water_drop, color: _getStatusColor(device.status))),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(device.name, style: Theme.of(context).textTheme.titleSmall), const SizedBox(height: 4), Text(device.location, style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary))])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('${device.currentTDS.toStringAsFixed(1)} ppm', style: Theme.of(context).textTheme.titleSmall!.copyWith(color: AppColors.primaryCyan, fontWeight: FontWeight.bold)), const SizedBox(height: 4), StatusIndicator(status: device.status, showLabel: true, size: 8)]),
        ],
      ),
    );
  }

  Widget _buildPieChart(int online, int warning, int critical, int offline) {
    final total = online + warning + critical + offline;
    if (total == 0) return const Center(child: Text('No data'));
    return PieChart(
      PieChartData(
        sections: [
          if (online > 0) PieChartSectionData(value: online.toDouble(), color: AppColors.statusNormal, title: '$online', radius: 50, titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
          if (warning > 0) PieChartSectionData(value: warning.toDouble(), color: AppColors.statusWarning, title: '$warning', radius: 50, titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black)),
          if (critical > 0) PieChartSectionData(value: critical.toDouble(), color: AppColors.statusCritical, title: '$critical', radius: 50, titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
          if (offline > 0) PieChartSectionData(value: offline.toDouble(), color: AppColors.statusOffline, title: '$offline', radius: 50, titleStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
        ],
        sectionsSpace: 2,
        centerSpaceRadius: 30,
      ),
    );
  }

  Color _getStatusColor(DeviceStatus status) {
    switch (status) {
      case DeviceStatus.online: return AppColors.statusNormal;
      case DeviceStatus.warning: return AppColors.statusWarning;
      case DeviceStatus.critical: return AppColors.statusCritical;
      case DeviceStatus.offline: return AppColors.statusOffline;
    }
  }
}
