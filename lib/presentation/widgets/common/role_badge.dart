import 'package:flutter/material.dart';
import '../../../core/theme/design_tokens.dart';

/// Role badge widget - institutional display
class RoleBadge extends StatelessWidget {
  final String role;
  final bool isCompact;

  const RoleBadge({
    super.key,
    required this.role,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final isAdmin = role.toLowerCase() == 'admin';
    final color = isAdmin 
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).colorScheme.secondary;

    if (isCompact) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: DesignTokens.space6,
          vertical: DesignTokens.space2,
        ),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
        ),
        child: Text(
          role.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall!.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DesignTokens.space12,
        vertical: DesignTokens.space6,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isAdmin ? Icons.admin_panel_settings : Icons.person,
            size: 16,
            color: color,
          ),
          const SizedBox(width: DesignTokens.space6),
          Text(
            role.toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium!.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
          ),
        ],
      ),
    );
  }
}

/// User profile header
class UserProfileHeader extends StatelessWidget {
  final String name;
  final String role;
  final String? email;
  final VoidCallback? onLogout;
  final VoidCallback? onSettings;

  const UserProfileHeader({
    super.key,
    required this.name,
    required this.role,
    this.email,
    this.onLogout,
    this.onSettings,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: Theme.of(context).textTheme.headlineSmall!.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ),
          ),
          
          const SizedBox(width: DesignTokens.space12),
          
          // Name & role
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleMedium!.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: DesignTokens.space4),
                RoleBadge(role: role, isCompact: true),
              ],
            ),
          ),
          
          // Actions
          if (onSettings != null)
            IconButton(
              icon: const Icon(Icons.settings_outlined),
              onPressed: onSettings,
            ),
          if (onLogout != null)
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: onLogout,
            ),
        ],
      ),
    );
  }
}

/// Session info display
class SessionInfo extends StatelessWidget {
  final DateTime sessionStart;
  final String? ipAddress;

  const SessionInfo({
    super.key,
    required this.sessionStart,
    this.ipAddress,
  });

  @override
  Widget build(BuildContext context) {
    final duration = DateTime.now().difference(sessionStart);
    
    return Container(
      padding: const EdgeInsets.all(DesignTokens.space12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.5),
        borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.access_time,
            size: 14,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: DesignTokens.space6),
          Text(
            'Session: ${_formatDuration(duration)}',
            style: Theme.of(context).textTheme.labelSmall!.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          if (ipAddress != null) ...[
            const SizedBox(width: DesignTokens.space12),
            Text(
              ipAddress!,
              style: Theme.of(context).textTheme.labelSmall!.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.7),
                  ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    if (d.inMinutes < 60) return '${d.inMinutes}m';
    if (d.inHours < 24) return '${d.inHours}h ${d.inMinutes % 60}m';
    return '${d.inDays}d ${d.inHours % 24}h';
  }
}
