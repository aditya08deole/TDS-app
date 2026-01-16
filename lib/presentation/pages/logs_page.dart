import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/design_tokens.dart';
import '../../domain/entities/alert.dart';
import '../../domain/entities/severity_level.dart';
import '../widgets/glass_card.dart';
import '../widgets/desktop/desktop_components.dart';
import '../providers/app_providers.dart';
import 'package:intl/intl.dart';

/// Logs and Alerts page - Responsive for Desktop
class LogsPage extends ConsumerStatefulWidget {
  const LogsPage({super.key});

  @override
  ConsumerState<LogsPage> createState() => _LogsPageState();
}

class _LogsPageState extends ConsumerState<LogsPage> {
  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'Critical', 'Warning', 'Info'];

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: alertsAsync.when(
          data: (alerts) => isDesktop
              ? _buildDesktopLayout(context, alerts)
              : _buildMobileLayout(context, alerts),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => Center(child: Text('Error: $error')),
        ),
      ),
    );
  }

  /// Desktop layout with table view
  Widget _buildDesktopLayout(BuildContext context, List<Alert> alerts) {
    final colorScheme = Theme.of(context).colorScheme;
    final filteredAlerts = _filterAlerts(alerts);

    return Padding(
      padding: const EdgeInsets.all(DesignTokens.space24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats row
          Row(
            children: [
              _buildAlertStatCard(context, 'Total', alerts.length, Colors.blue),
              const SizedBox(width: DesignTokens.space16),
              _buildAlertStatCard(
                context,
                'Critical',
                alerts.where((a) => a.severity == SeverityLevel.critical || a.severity == SeverityLevel.emergency).length,
                AppColors.statusCritical,
              ),
              const SizedBox(width: DesignTokens.space16),
              _buildAlertStatCard(
                context,
                'Warning',
                alerts.where((a) => a.severity == SeverityLevel.warning).length,
                AppColors.statusWarning,
              ),
              const SizedBox(width: DesignTokens.space16),
              _buildAlertStatCard(
                context,
                'Unread',
                alerts.where((a) => !a.isAcknowledged).length,
                AppColors.primaryCyan,
              ),
            ],
          ),
          const SizedBox(height: DesignTokens.space24),

          // Table panel
          Expanded(
            child: DesktopPanel(
              title: 'Alert History',
              subtitle: '${filteredAlerts.length} alerts',
              icon: Icons.notifications_outlined,
              actions: [
                // Filter chips
                DesktopTabBar(
                  tabs: _filters,
                  selectedIndex: _filters.indexOf(_selectedFilter),
                  onTabSelected: (index) {
                    setState(() => _selectedFilter = _filters[index]);
                  },
                ),
                const SizedBox(width: DesignTokens.space16),
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: () => ref.invalidate(alertsProvider),
                  tooltip: 'Refresh',
                ),
              ],
              padding: EdgeInsets.zero,
              child: filteredAlerts.isEmpty
                  ? _buildEmptyState(context)
                  : _buildAlertTable(context, filteredAlerts),
            ),
          ),
        ],
      ),
    );
  }

  /// Mobile layout with cards
  Widget _buildMobileLayout(BuildContext context, List<Alert> alerts) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // Header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: GlassCard(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: AppColors.primaryGradient),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.notifications, color: Colors.black, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Alerts & Logs',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          'System notifications and events',
                          style: Theme.of(context).textTheme.bodySmall!.copyWith(
                                color: AppColors.textTertiary,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Alerts List
        if (alerts.isEmpty)
          SliverFillRemaining(child: _buildEmptyState(context))
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final alert = alerts[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _buildAlertCard(context, alert),
                  );
                },
                childCount: alerts.length,
              ),
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),
      ],
    );
  }

  List<Alert> _filterAlerts(List<Alert> alerts) {
    switch (_selectedFilter) {
      case 'Critical':
        return alerts.where((a) =>
            a.severity == SeverityLevel.critical ||
            a.severity == SeverityLevel.emergency).toList();
      case 'Warning':
        return alerts.where((a) => a.severity == SeverityLevel.warning).toList();
      case 'Info':
        return alerts.where((a) => a.severity == SeverityLevel.informational).toList();
      default:
        return alerts;
    }
  }

  Widget _buildAlertStatCard(BuildContext context, String label, int value, Color color) {
    final colorScheme = Theme.of(context).colorScheme;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(DesignTokens.space16),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
          border: Border.all(
            color: colorScheme.outlineVariant.withOpacity(0.5),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(DesignTokens.space12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
              ),
              child: Icon(Icons.notifications_outlined, color: color, size: 24),
            ),
            const SizedBox(width: DesignTokens.space12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value.toString(),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color,
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
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 64,
            color: AppColors.statusNormal,
          ),
          const SizedBox(height: 16),
          Text(
            'No Alerts',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'All systems are running normally',
            style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                  color: AppColors.textTertiary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertTable(BuildContext context, List<Alert> alerts) {
    final colorScheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStateProperty.all(
          colorScheme.surfaceContainerHighest.withOpacity(0.5),
        ),
        dataRowColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.hovered)) {
            return colorScheme.primary.withOpacity(0.05);
          }
          return null;
        }),
        columns: const [
          DataColumn(label: Text('Severity')),
          DataColumn(label: Text('Type')),
          DataColumn(label: Text('Message')),
          DataColumn(label: Text('Value')),
          DataColumn(label: Text('Timestamp')),
          DataColumn(label: Text('Status')),
          DataColumn(label: Text('Actions')),
        ],
        rows: alerts.map((alert) {
          final severityColor = _getSeverityColor(alert.severity);
          return DataRow(
            cells: [
              DataCell(
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: severityColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    alert.severity.displayName,
                    style: TextStyle(
                      color: severityColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              DataCell(Text(alert.type.name.toUpperCase())),
              DataCell(
                SizedBox(
                  width: 300,
                  child: Text(
                    alert.message,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              DataCell(
                Text(
                  alert.value != null
                      ? '${alert.value!.toStringAsFixed(1)} ${alert.metricUnit ?? 'ppm'}'
                      : 'N/A',
                  style: TextStyle(
                    color: AppColors.primaryCyan,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              DataCell(Text(DateFormat('MMM d, HH:mm').format(alert.timestamp))),
              DataCell(
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: alert.isAcknowledged
                        ? Colors.green.withOpacity(0.15)
                        : Colors.orange.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    alert.isAcknowledged ? 'Read' : 'Unread',
                    style: TextStyle(
                      color: alert.isAcknowledged ? Colors.green : Colors.orange,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              DataCell(
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.visibility_outlined, size: 18),
                      onPressed: () {},
                      tooltip: 'View details',
                      visualDensity: VisualDensity.compact,
                    ),
                    if (!alert.isAcknowledged)
                      IconButton(
                        icon: const Icon(Icons.check, size: 18),
                        onPressed: () {},
                        tooltip: 'Mark as read',
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Color _getSeverityColor(SeverityLevel severity) {
    switch (severity) {
      case SeverityLevel.critical:
      case SeverityLevel.emergency:
        return AppColors.statusCritical;
      case SeverityLevel.warning:
        return AppColors.statusWarning;
      case SeverityLevel.informational:
        return AppColors.primaryCyan;
    }
  }

  Widget _buildAlertCard(BuildContext context, Alert alert) {
    Color severityColor;
    IconData severityIcon;

    switch (alert.severity) {
      case SeverityLevel.critical:
      case SeverityLevel.emergency:
        severityColor = AppColors.statusCritical;
        severityIcon = Icons.error;
        break;
      case SeverityLevel.warning:
        severityColor = AppColors.statusWarning;
        severityIcon = Icons.warning_amber;
        break;
      case SeverityLevel.informational:
        severityColor = AppColors.primaryCyan;
        severityIcon = Icons.info;
        break;
    }

    return GlassCard(
      padding: const EdgeInsets.all(16),
      border: Border.all(
        color: severityColor.withOpacity(0.3),
        width: 1.5,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: severityColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(severityIcon, color: severityColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.severity.displayName,
                      style: TextStyle(
                        color: severityColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      alert.type.name.toUpperCase(),
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ],
                ),
              ),
              if (!alert.isAcknowledged)
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: severityColor,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            alert.message,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.water_drop_outlined,
                    size: 16,
                    color: AppColors.primaryCyan,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    alert.value != null
                        ? '${alert.value!.toStringAsFixed(1)} ${alert.metricUnit ?? 'ppm'}'
                        : 'N/A',
                    style: Theme.of(context).textTheme.bodySmall!.copyWith(
                          color: AppColors.primaryCyan,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ),
              Text(
                DateFormat('MMM dd, HH:mm').format(alert.timestamp),
                style: Theme.of(context).textTheme.bodySmall!.copyWith(
                      color: AppColors.textTertiary,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
