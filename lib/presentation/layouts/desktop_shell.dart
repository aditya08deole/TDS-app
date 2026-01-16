import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/design_tokens.dart';
import '../providers/app_providers.dart';
import '../providers/supabase_providers.dart';
import '../widgets/theme_toggle.dart';

/// Navigation item data
class NavItem {
  final String id;
  final String label;
  final IconData icon;
  final IconData? activeIcon;
  final bool adminOnly;

  const NavItem({
    required this.id,
    required this.label,
    required this.icon,
    this.activeIcon,
    this.adminOnly = false,
  });
}

/// Provider for current navigation index
final currentNavIndexProvider = StateProvider<int>((ref) => 0);

/// Desktop shell layout with sidebar and top bar
class DesktopShell extends ConsumerStatefulWidget {
  final List<NavItem> navItems;
  final List<Widget> pages;
  final String appTitle;
  final Widget? logo;
  final List<Widget>? actions;

  const DesktopShell({
    super.key,
    required this.navItems,
    required this.pages,
    this.appTitle = 'EvaraTDS',
    this.logo,
    this.actions,
  });

  @override
  ConsumerState<DesktopShell> createState() => _DesktopShellState();
}

class _DesktopShellState extends ConsumerState<DesktopShell> {
  bool _isSidebarExpanded = true;
  bool _isSidebarHovered = false;

  @override
  Widget build(BuildContext context) {
    final currentIndex = ref.watch(currentNavIndexProvider);
    final userAsync = ref.watch(currentUserProvider);
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);
    final isTablet = ResponsiveBreakpoints.isTablet(context);
    final colorScheme = Theme.of(context).colorScheme;

    // Filter nav items based on user role
    final filteredNavItems = userAsync.maybeWhen(
      data: (user) {
        if (user?.isAdmin == true) {
          return widget.navItems;
        }
        return widget.navItems.where((item) => !item.adminOnly).toList();
      },
      orElse: () => widget.navItems.where((item) => !item.adminOnly).toList(),
    );

    if (isDesktop || isTablet) {
      // Desktop/Tablet layout with sidebar
      return Scaffold(
        body: Row(
          children: [
            // Sidebar
            _buildSidebar(
              context,
              filteredNavItems,
              currentIndex,
              isTablet ? false : _isSidebarExpanded,
            ),
            // Main content
            Expanded(
              child: Column(
                children: [
                  // Top bar
                  _buildTopBar(context),
                  // Page content
                  Expanded(
                    child: widget.pages[currentIndex],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Mobile layout with bottom nav
    return Scaffold(
      body: widget.pages[currentIndex],
      bottomNavigationBar: _buildBottomNav(
        context,
        filteredNavItems,
        currentIndex,
      ),
    );
  }

  Widget _buildSidebar(
    BuildContext context,
    List<NavItem> navItems,
    int currentIndex,
    bool expanded,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final isTablet = ResponsiveBreakpoints.isTablet(context);
    
    final sidebarWidth = expanded ? 260.0 : 72.0;

    return MouseRegion(
      onEnter: (_) {
        if (!_isSidebarExpanded && !isTablet) {
          setState(() => _isSidebarHovered = true);
        }
      },
      onExit: (_) {
        setState(() => _isSidebarHovered = false);
      },
      child: AnimatedContainer(
        duration: DesignTokens.durationNormal,
        width: _isSidebarHovered && !_isSidebarExpanded ? 260.0 : sidebarWidth,
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(
            right: BorderSide(
              color: colorScheme.outlineVariant.withOpacity(0.5),
              width: 1,
            ),
          ),
        ),
        child: Column(
          children: [
            // Logo section
            _buildLogoSection(context, expanded || _isSidebarHovered),
            const SizedBox(height: DesignTokens.space16),
            
            // Navigation items
            Expanded(
              child: ListView.builder(
                padding: EdgeInsets.symmetric(
                  horizontal: expanded || _isSidebarHovered ? 12 : 8,
                  vertical: 8,
                ),
                itemCount: navItems.length,
                itemBuilder: (context, index) {
                  return _buildNavItem(
                    context,
                    navItems[index],
                    index == currentIndex,
                    expanded || _isSidebarHovered,
                    () => ref.read(currentNavIndexProvider.notifier).state = index,
                  );
                },
              ),
            ),

            // Bottom section with toggle
            if (!isTablet)
              _buildSidebarToggle(context, expanded),
            
            // User section
            _buildUserSection(context, expanded || _isSidebarHovered),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoSection(BuildContext context, bool expanded) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: 64,
      padding: EdgeInsets.symmetric(
        horizontal: expanded ? 20 : 0,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: colorScheme.outlineVariant.withOpacity(0.3),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  colorScheme.primary,
                  colorScheme.secondary,
                ],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.water_drop,
              color: colorScheme.onPrimary,
              size: 24,
            ),
          ),
          if (expanded) ...[
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.appTitle,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Water Quality Monitor',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    NavItem item,
    bool isSelected,
    bool expanded,
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
          child: AnimatedContainer(
            duration: DesignTokens.durationFast,
            padding: EdgeInsets.symmetric(
              horizontal: expanded ? 16 : 0,
              vertical: 12,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? colorScheme.primary.withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
              border: isSelected
                  ? Border.all(
                      color: colorScheme.primary.withOpacity(0.3),
                      width: 1,
                    )
                  : null,
            ),
            child: Row(
              mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
              children: [
                Icon(
                  isSelected ? (item.activeIcon ?? item.icon) : item.icon,
                  color: isSelected
                      ? colorScheme.primary
                      : colorScheme.onSurfaceVariant,
                  size: 22,
                ),
                if (expanded) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: isSelected
                            ? colorScheme.primary
                            : colorScheme.onSurfaceVariant,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSidebarToggle(BuildContext context, bool expanded) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: expanded ? 12 : 8,
        vertical: 8,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        child: InkWell(
          onTap: () => setState(() => _isSidebarExpanded = !_isSidebarExpanded),
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: expanded ? 16 : 0,
              vertical: 12,
            ),
            child: Row(
              mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
              children: [
                Icon(
                  expanded ? Icons.chevron_left : Icons.chevron_right,
                  color: colorScheme.onSurfaceVariant,
                  size: 22,
                ),
                if (expanded) ...[
                  const SizedBox(width: 12),
                  Text(
                    'Collapse',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUserSection(BuildContext context, bool expanded) {
    final colorScheme = Theme.of(context).colorScheme;
    final userAsync = ref.watch(currentUserProvider);

    return Container(
      padding: EdgeInsets.all(expanded ? 16 : 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: colorScheme.outlineVariant.withOpacity(0.3),
            width: 1,
          ),
        ),
      ),
      child: userAsync.when(
        data: (user) {
          if (user == null) return const SizedBox.shrink();
          return Row(
            mainAxisAlignment: expanded ? MainAxisAlignment.start : MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: colorScheme.primary.withOpacity(0.2),
                child: Text(
                  user.username.substring(0, 1).toUpperCase(),
                  style: TextStyle(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (expanded) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.username,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        user.isAdmin ? 'Administrator' : 'Operator',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          );
        },
        loading: () => const SizedBox.shrink(),
        error: (_, __) => const SizedBox.shrink(),
      ),
    );
  }

  Widget _buildTopBar(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final currentIndex = ref.watch(currentNavIndexProvider);
    final navItems = widget.navItems;

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: colorScheme.outlineVariant.withOpacity(0.5),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          // Breadcrumb / Current page
          Expanded(
            child: Text(
              currentIndex < navItems.length ? navItems[currentIndex].label : '',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // Actions
          if (widget.actions != null) ...widget.actions!,
          const SizedBox(width: 8),
          // Theme toggle
          const ThemeToggleButton(),
          const SizedBox(width: 8),
          // Notifications
          _buildNotificationButton(context),
          const SizedBox(width: 4),
          // Logout
          _buildLogoutButton(context),
          const SizedBox(width: 4),
          // Settings
          _buildSettingsButton(context),
        ],
      ),
    );
  }

  Widget _buildNotificationButton(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return IconButton(
      icon: Badge(
        label: const Text('3'),
        child: Icon(
          Icons.notifications_outlined,
          color: colorScheme.onSurfaceVariant,
        ),
      ),
      onPressed: () {
        // TODO: Show notifications panel
      },
      tooltip: 'Notifications',
    );
  }

  Widget _buildSettingsButton(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return IconButton(
      icon: Icon(
        Icons.settings_outlined,
        color: colorScheme.onSurfaceVariant,
      ),
      onPressed: () {
        ref.read(currentNavIndexProvider.notifier).state = widget.navItems.length - 1;
      },
      tooltip: 'Settings',
    );
  }

  Widget _buildLogoutButton(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return IconButton(
      icon: Icon(
        Icons.logout,
        color: colorScheme.error,
      ),
      onPressed: () async {
        // Show confirmation dialog
        final confirm = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Logout'),
            content: const Text('Are you sure you want to logout?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: FilledButton.styleFrom(
                  backgroundColor: colorScheme.error,
                ),
                child: const Text('Logout'),
              ),
            ],
          ),
        );
        
        if (confirm == true) {
          final authService = ref.read(supabaseAuthServiceProvider);
          await authService.signOut();
        }
      },
      tooltip: 'Logout',
    );
  }

  Widget _buildBottomNav(
    BuildContext context,
    List<NavItem> navItems,
    int currentIndex,
  ) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: colorScheme.outlineVariant.withOpacity(0.5),
            width: 1,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(navItems.length, (index) {
              final item = navItems[index];
              final isSelected = currentIndex == index;

              return Expanded(
                child: InkWell(
                  onTap: () => ref.read(currentNavIndexProvider.notifier).state = index,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      color: isSelected
                          ? colorScheme.primary.withOpacity(0.1)
                          : Colors.transparent,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isSelected ? (item.activeIcon ?? item.icon) : item.icon,
                          color: isSelected
                              ? colorScheme.primary
                              : colorScheme.onSurfaceVariant,
                          size: 24,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.label,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isSelected
                                ? colorScheme.primary
                                : colorScheme.onSurfaceVariant,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
