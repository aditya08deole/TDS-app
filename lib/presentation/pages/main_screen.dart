import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../layouts/desktop_shell.dart';
import '../widgets/gradient_background.dart';
import '../providers/supabase_providers.dart';
import 'map_view_page.dart';
import 'dashboard_page.dart';
import 'logs_page.dart';
import 'settings_page.dart';
import 'auth/auth_wrapper.dart';

/// Main screen with responsive desktop/mobile navigation
class MainScreen extends ConsumerWidget {
  const MainScreen({super.key});

  static const List<NavItem> _navItems = [
    NavItem(
      id: 'map',
      label: 'Map View',
      icon: Icons.map_outlined,
      activeIcon: Icons.map,
    ),
    NavItem(
      id: 'dashboard',
      label: 'Dashboard',
      icon: Icons.dashboard_outlined,
      activeIcon: Icons.dashboard,
    ),
    NavItem(
      id: 'logs',
      label: 'Alerts & Logs',
      icon: Icons.notifications_outlined,
      activeIcon: Icons.notifications,
    ),
    NavItem(
      id: 'settings',
      label: 'Settings',
      icon: Icons.settings_outlined,
      activeIcon: Icons.settings,
      adminOnly: true,
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the auth state stream to properly react to auth changes
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (state) {
        // Check if user is logged in
        if (state.session == null) {
          return const AuthWrapper(allowAdminSignUp: true);
        }

        // Simple email-based admin check (hardcoded for adityadeole08@gmail.com)
        final isAdmin = ref.watch(isAdminProvider);
        
        // Build pages list based on user role
        final List<Widget> pages = [
          const GradientBackground(child: MapViewPage()),
          const GradientBackground(child: DashboardPage()),
          const GradientBackground(child: LogsPage()),
          if (isAdmin) const GradientBackground(child: SettingsPage()),
        ];

        // Filter nav items for non-admin users
        final navItems = isAdmin 
            ? _navItems 
            : _navItems.where((item) => !item.adminOnly).toList();

        return DesktopShell(
          navItems: navItems,
          pages: pages,
          appTitle: 'EvaraTDS',
        );
      },
      loading: () => const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      ),
      error: (_, __) => const AuthWrapper(allowAdminSignUp: true),
    );
  }
}
