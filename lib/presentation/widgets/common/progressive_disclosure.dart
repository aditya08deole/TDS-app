import 'package:flutter/material.dart';
import '../../../core/theme/design_tokens.dart';

/// Progressive disclosure container
/// Shows summary first, details on demand
class ProgressiveDisclosure extends StatefulWidget {
  final Widget summary;
  final Widget details;
  final String? expandLabel;
  final String? collapseLabel;
  final bool initiallyExpanded;

  const ProgressiveDisclosure({
    super.key,
    required this.summary,
    required this.details,
    this.expandLabel,
    this.collapseLabel,
    this.initiallyExpanded = false,
  });

  @override
  State<ProgressiveDisclosure> createState() => _ProgressiveDisclosureState();
}

class _ProgressiveDisclosureState extends State<ProgressiveDisclosure> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.summary,
        const SizedBox(height: DesignTokens.space8),
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: DesignTokens.space4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  size: 18,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: DesignTokens.space4),
                Text(
                  _expanded 
                      ? (widget.collapseLabel ?? 'Show less')
                      : (widget.expandLabel ?? 'Show details'),
                  style: Theme.of(context).textTheme.bodySmall!.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          firstChild: const SizedBox.shrink(),
          secondChild: Padding(
            padding: const EdgeInsets.only(top: DesignTokens.space12),
            child: widget.details,
          ),
          crossFadeState: _expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
          duration: DesignTokens.durationMedium,
        ),
      ],
    );
  }
}

/// Status summary card for quick glance
class StatusSummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final VoidCallback? onTap;

  const StatusSummaryCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Theme.of(context).colorScheme.primary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      child: Container(
        padding: const EdgeInsets.all(DesignTokens.space16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          border: Border.all(
            color: effectiveColor.withOpacity(0.2),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: effectiveColor, size: 20),
                const Spacer(),
                if (onTap != null)
                  Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              ],
            ),
            const SizedBox(height: DesignTokens.space12),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall!.copyWith(
                    fontWeight: FontWeight.bold,
                    color: effectiveColor,
                  ),
            ),
            const SizedBox(height: DesignTokens.space4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall!.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
