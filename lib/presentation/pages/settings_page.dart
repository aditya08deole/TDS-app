import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/design_tokens.dart';
import '../../core/constants/app_constants.dart';
import '../widgets/glass_card.dart';
import '../widgets/neon_button.dart';
import '../widgets/desktop/desktop_components.dart';
import '../providers/app_providers.dart';
import '../providers/supabase_providers.dart';
import '../../domain/entities/models/device_model.dart';
import 'device_management_page.dart';

/// Settings page (Admin only) - Responsive for Desktop
class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  int _selectedSection = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider).value;
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: isDesktop
            ? _buildDesktopLayout(context, user)
            : _buildMobileLayout(context, user),
      ),
    );
  }

  /// Desktop layout with side menu
  Widget _buildDesktopLayout(BuildContext context, user) {
    final colorScheme = Theme.of(context).colorScheme;

    final sections = [
      {'title': 'Profile', 'icon': Icons.person_outline},
      {'title': 'Devices', 'icon': Icons.devices_outlined},
      {'title': 'Users', 'icon': Icons.people_outline},
      {'title': 'Notifications', 'icon': Icons.notifications_outlined},
      {'title': 'Export', 'icon': Icons.download_outlined},
      {'title': 'System', 'icon': Icons.settings_outlined},
    ];

    return Padding(
      padding: const EdgeInsets.all(DesignTokens.space24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left menu
          Container(
            width: 260,
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
              border: Border.all(
                color: colorScheme.outlineVariant.withOpacity(0.5),
              ),
            ),
            child: Column(
              children: [
                // User card
                Container(
                  padding: const EdgeInsets.all(DesignTokens.space20),
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
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: AppColors.primaryGradient),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.person, color: Colors.black, size: 24),
                      ),
                      const SizedBox(width: DesignTokens.space12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.username ?? 'Admin',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              'Administrator',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Menu items
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(DesignTokens.space8),
                    itemCount: sections.length,
                    itemBuilder: (context, index) {
                      final section = sections[index];
                      final isSelected = _selectedSection == index;
                      return _buildDesktopMenuItem(
                        context,
                        section['title'] as String,
                        section['icon'] as IconData,
                        isSelected,
                        () => setState(() => _selectedSection = index),
                      );
                    },
                  ),
                ),
                // Logout
                Padding(
                  padding: const EdgeInsets.all(DesignTokens.space16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await ref.read(currentUserProvider.notifier).logout();
                        if (context.mounted) {
                          Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
                        }
                      },
                      icon: const Icon(Icons.logout, size: 18),
                      label: const Text('Logout'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colorScheme.error,
                        side: BorderSide(color: colorScheme.error.withOpacity(0.5)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: DesignTokens.space24),
          // Main content
          Expanded(
            child: _buildDesktopContent(context, _selectedSection),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopMenuItem(
    BuildContext context,
    String title,
    IconData icon,
    bool isSelected,
    VoidCallback onTap,
  ) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: DesignTokens.space16,
              vertical: DesignTokens.space12,
            ),
            decoration: BoxDecoration(
              color: isSelected ? colorScheme.primary.withOpacity(0.1) : null,
              borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: DesignTokens.space12),
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isSelected ? colorScheme.primary : colorScheme.onSurface,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDesktopContent(BuildContext context, int sectionIndex) {
    switch (sectionIndex) {
      case 0:
        return _buildProfileSection(context);
      case 1:
        return _buildDevicesSection(context);
      case 2:
        return _buildUsersSection(context);
      case 3:
        return _buildNotificationsSection(context);
      case 4:
        return _buildExportSection(context);
      case 5:
        return _buildSystemSection(context);
      default:
        return _buildProfileSection(context);
    }
  }

  Widget _buildProfileSection(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final user = ref.watch(currentUserProvider).value;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'Profile Information',
          subtitle: 'Manage your account details',
          icon: Icons.person_outline,
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: Column(
            children: [
              _buildProfileField(context, 'Username', user?.username ?? 'Admin'),
              const SizedBox(height: DesignTokens.space16),
              _buildProfileField(context, 'Email', user?.email ?? 'admin@evaratds.com'),
              const SizedBox(height: DesignTokens.space16),
              _buildProfileField(context, 'Role', 'Administrator'),
              const SizedBox(height: DesignTokens.space24),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _showComingSoonDialog(context),
                    icon: const Icon(Icons.edit, size: 18),
                    label: const Text('Edit Profile'),
                  ),
                  const SizedBox(width: DesignTokens.space12),
                  OutlinedButton.icon(
                    onPressed: () => _showComingSoonDialog(context),
                    icon: const Icon(Icons.lock_outline, size: 18),
                    label: const Text('Change Password'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProfileField(BuildContext context, String label, String value) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDevicesSection(BuildContext context) {
    final devicesAsync = ref.watch(deviceDataProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'Device Management',
          subtitle: 'Add, edit, and configure TDS devices with ThingSpeak integration',
          icon: Icons.devices_outlined,
          actions: [
            ElevatedButton.icon(
              onPressed: () => _openDeviceManagement(context, null),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add Device'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryCyan,
                foregroundColor: Colors.black,
              ),
            ),
          ],
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: devicesAsync.when(
            data: (devices) => devices.isEmpty
                ? _buildEmptyDevicesContent(context)
                : _buildDevicesList(context, devices),
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (error, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.error_outline, size: 48, color: colorScheme.error),
                    const SizedBox(height: 16),
                    Text('Error loading devices: $error'),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(deviceDataProvider),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyDevicesContent(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.devices_outlined,
            size: 64,
            color: AppColors.primaryCyan.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No devices configured',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Add your first device to start monitoring water quality',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => _openDeviceManagement(context, null),
            icon: const Icon(Icons.add),
            label: const Text('Add Device'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryCyan,
              foregroundColor: Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicesList(BuildContext context, List<DeviceModel> devices) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        // Stats row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              _buildDeviceStat(context, 'Total', devices.length.toString(), Icons.devices),
              const SizedBox(width: 24),
              _buildDeviceStat(
                context,
                'Online',
                devices.where((d) => d.status.name == 'online').length.toString(),
                Icons.check_circle,
                color: AppColors.statusNormal,
              ),
              const SizedBox(width: 24),
              _buildDeviceStat(
                context,
                'Warning',
                devices.where((d) => d.status.name == 'warning').length.toString(),
                Icons.warning,
                color: AppColors.statusWarning,
              ),
              const SizedBox(width: 24),
              _buildDeviceStat(
                context,
                'Critical',
                devices.where((d) => d.status.name == 'critical').length.toString(),
                Icons.error,
                color: AppColors.statusCritical,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Device list
        ...devices.map((device) => _buildDeviceCard(context, device)),
      ],
    );
  }

  Widget _buildDeviceStat(BuildContext context, String label, String value, IconData icon, {Color? color}) {
    return Row(
      children: [
        Icon(icon, size: 20, color: color ?? AppColors.primaryCyan),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ],
    );
  }

  Widget _buildDeviceCard(BuildContext context, DeviceModel device) {
    final colorScheme = Theme.of(context).colorScheme;
    final statusColor = _getStatusColor(device.status.name);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: statusColor.withOpacity(0.5),
                  blurRadius: 8,
                  spreadRadius: 2,
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Device info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  device.location,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                if (device.hasThingspeakConfig) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.cloud_outlined, size: 14, color: AppColors.primaryCyan),
                      const SizedBox(width: 4),
                      Text(
                        'ThingSpeak Connected',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.primaryCyan,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          // Current reading
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${device.currentTds.toStringAsFixed(0)} ppm',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: statusColor,
                ),
              ),
              if (device.temperature != null)
                Text(
                  '${device.temperature!.toStringAsFixed(1)}°C',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
          const SizedBox(width: 16),
          // Actions
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => _openDeviceManagement(context, device),
            tooltip: 'Edit Device',
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () => _confirmDeleteDevice(context, device),
            tooltip: 'Delete Device',
            color: colorScheme.error,
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'online':
        return AppColors.statusNormal;
      case 'warning':
        return AppColors.statusWarning;
      case 'critical':
        return AppColors.statusCritical;
      default:
        return Colors.grey;
    }
  }

  void _openDeviceManagement(BuildContext context, DeviceModel? device) async {
    final result = await Navigator.of(context).push<DeviceModel>(
      MaterialPageRoute(
        builder: (context) => DeviceManagementPage(device: device),
      ),
    );

    if (result != null) {
      ref.invalidate(deviceDataProvider);
      ref.invalidate(supabaseTDSDevicesProvider);
    }
  }

  void _confirmDeleteDevice(BuildContext context, DeviceModel device) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Device'),
        content: Text('Are you sure you want to delete "${device.name}"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(context).pop();
              final deviceService = ref.read(deviceDataServiceProvider);
              final success = await deviceService.deleteDevice(device.id);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Device deleted successfully'),
                    backgroundColor: AppColors.statusNormal,
                  ),
                );
                ref.invalidate(deviceDataProvider);
                ref.invalidate(supabaseTDSDevicesProvider);
              }
            },
            child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );
  }

  Widget _buildUsersSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'User Management',
          subtitle: 'Manage user accounts and permissions',
          icon: Icons.people_outline,
          actions: [
            ElevatedButton.icon(
              onPressed: () => _showComingSoonDialog(context),
              icon: const Icon(Icons.person_add, size: 18),
              label: const Text('Add User'),
            ),
          ],
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: _buildComingSoonContent(context, 'User management features'),
        ),
      ],
    );
  }

  Widget _buildNotificationsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'Notification Settings',
          subtitle: 'Configure how you receive alerts',
          icon: Icons.notifications_outlined,
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: _buildComingSoonContent(context, 'Notification settings'),
        ),
      ],
    );
  }

  Widget _buildExportSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'Data Export',
          subtitle: 'Export reports and historical data',
          icon: Icons.download_outlined,
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: _buildComingSoonContent(context, 'Data export features'),
        ),
      ],
    );
  }

  Widget _buildSystemSection(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DesktopPanel(
          title: 'System Information',
          subtitle: 'Application details and diagnostics',
          icon: Icons.settings_outlined,
          padding: const EdgeInsets.all(DesignTokens.space24),
          child: Column(
            children: [
              _buildProfileField(context, 'App Name', AppConstants.appName),
              const SizedBox(height: DesignTokens.space12),
              _buildProfileField(context, 'Version', AppConstants.appVersion),
              const SizedBox(height: DesignTokens.space12),
              _buildProfileField(context, 'Build', 'Production'),
              const SizedBox(height: DesignTokens.space24),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _showComingSoonDialog(context),
                    icon: const Icon(Icons.bug_report_outlined, size: 18),
                    label: const Text('Diagnostics'),
                  ),
                  const SizedBox(width: DesignTokens.space12),
                  OutlinedButton.icon(
                    onPressed: () => _showComingSoonDialog(context),
                    icon: const Icon(Icons.info_outline, size: 18),
                    label: const Text('About'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildComingSoonContent(BuildContext context, String feature) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(DesignTokens.space32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.construction_outlined,
            size: 48,
            color: colorScheme.onSurfaceVariant.withOpacity(0.5),
          ),
          const SizedBox(height: DesignTokens.space16),
          Text(
            'Coming Soon',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: DesignTokens.space8),
          Text(
            '$feature will be available in a future update.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant.withOpacity(0.7),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// Mobile layout with scroll view
  Widget _buildMobileLayout(BuildContext context, user) {
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
                    child: const Icon(Icons.settings, color: Colors.black, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Settings', style: Theme.of(context).textTheme.titleLarge),
                        Text(
                          'Admin configuration panel',
                          style: Theme.of(context).textTheme.bodySmall!.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: AppColors.primaryGradient),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'ADMIN',
                      style: Theme.of(context).textTheme.labelSmall!.copyWith(
                        color: Colors.black,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // User Info
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GlassCard(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: AppColors.primaryGradient),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.person, color: Colors.black, size: 32),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?.username ?? 'Admin', style: Theme.of(context).textTheme.titleLarge),
                        Text(
                          user?.email ?? 'admin@evaratds.com',
                          style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // Device Management Section
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Device Management',
              style: Theme.of(context).textTheme.titleMedium!.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _buildSettingTile(context, 'Add New Device', 'Register a new TDS monitoring device', Icons.add_circle_outline, () => _showComingSoonDialog(context)),
              const SizedBox(height: 12),
              _buildSettingTile(context, 'Edit Devices', 'Modify device configurations', Icons.edit_outlined, () => _showComingSoonDialog(context)),
              const SizedBox(height: 12),
              _buildSettingTile(context, 'Alert Thresholds', 'Configure warning and critical levels', Icons.tune_outlined, () => _showComingSoonDialog(context)),
            ]),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // System Section
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'System',
              style: Theme.of(context).textTheme.titleMedium!.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _buildSettingTile(context, 'User Management', 'Manage user accounts and permissions', Icons.people_outline, () => _showComingSoonDialog(context)),
              const SizedBox(height: 12),
              _buildSettingTile(context, 'Notifications', 'Configure alert notification settings', Icons.notifications_outlined, () => _showComingSoonDialog(context)),
              const SizedBox(height: 12),
              _buildSettingTile(context, 'Data Export', 'Export historical data and reports', Icons.download_outlined, () => _showComingSoonDialog(context)),
            ]),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),

        // Logout Button
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: NeonButton(
              text: 'Logout',
              icon: Icons.logout,
              color: AppColors.statusCritical,
              onPressed: () async {
                await ref.read(currentUserProvider.notifier).logout();
                if (context.mounted) {
                  Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
                }
              },
            ),
          ),
        ),

        // App Info
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              children: [
                Text(
                  AppConstants.appName,
                  style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary),
                ),
                Text(
                  'Version ${AppConstants.appVersion}',
                  style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary, fontSize: 10),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingTile(BuildContext context, String title, String subtitle, IconData icon, VoidCallback onTap) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primaryCyan.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.primaryCyan, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall!.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ],
      ),
    );
  }

  void _showComingSoonDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.construction, color: AppColors.primaryCyan),
            const SizedBox(width: 12),
            const Text('Coming Soon'),
          ],
        ),
        content: const Text('This feature is under development and will be available in a future update.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK', style: TextStyle(color: AppColors.primaryCyan)),
          ),
        ],
      ),
    );
  }
}
