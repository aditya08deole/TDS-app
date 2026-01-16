import 'package:flutter/material.dart';
import '../../../core/responsive/responsive_breakpoints.dart';
import '../../../core/theme/design_tokens.dart';

/// Desktop-optimized data table with responsive behavior
class ResponsiveDataTable extends StatelessWidget {
  final List<DataColumn> columns;
  final List<DataRow> rows;
  final bool showCheckboxColumn;
  final double? minWidth;
  final Widget? emptyState;
  final bool sortAscending;
  final int? sortColumnIndex;
  final ValueChanged<bool?>? onSelectAll;

  const ResponsiveDataTable({
    super.key,
    required this.columns,
    required this.rows,
    this.showCheckboxColumn = false,
    this.minWidth,
    this.emptyState,
    this.sortAscending = true,
    this.sortColumnIndex,
    this.onSelectAll,
  });

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty && emptyState != null) {
      return emptyState!;
    }

    final colorScheme = Theme.of(context).colorScheme;
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minWidth: minWidth ?? (isDesktop ? 800 : 600),
            ),
            child: DataTable(
              columns: columns,
              rows: rows,
              showCheckboxColumn: showCheckboxColumn,
              sortAscending: sortAscending,
              sortColumnIndex: sortColumnIndex,
              onSelectAll: onSelectAll,
              headingRowColor: WidgetStateProperty.all(
                colorScheme.surfaceContainerHighest.withOpacity(0.5),
              ),
              dataRowColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.hovered)) {
                  return colorScheme.primary.withOpacity(0.05);
                }
                return null;
              }),
              headingTextStyle: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
              dataTextStyle: Theme.of(context).textTheme.bodyMedium,
              columnSpacing: isDesktop ? 56 : 40,
              horizontalMargin: isDesktop ? 24 : 16,
              dividerThickness: 1,
            ),
          ),
        ),
      ),
    );
  }
}

/// Responsive list/card view that switches based on screen size
class ResponsiveListView<T> extends StatelessWidget {
  final List<T> items;
  final Widget Function(BuildContext context, T item, bool isDesktop) itemBuilder;
  final Widget Function(BuildContext context, T item)? desktopItemBuilder;
  final Widget Function(BuildContext context, T item)? mobileItemBuilder;
  final Widget? emptyState;
  final EdgeInsets? padding;
  final double spacing;
  final ScrollController? controller;
  final bool shrinkWrap;

  const ResponsiveListView({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.desktopItemBuilder,
    this.mobileItemBuilder,
    this.emptyState,
    this.padding,
    this.spacing = 12,
    this.controller,
    this.shrinkWrap = false,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty && emptyState != null) {
      return emptyState!;
    }

    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return ListView.separated(
      controller: controller,
      shrinkWrap: shrinkWrap,
      padding: padding ?? EdgeInsets.all(isDesktop ? 24 : 16),
      itemCount: items.length,
      separatorBuilder: (_, __) => SizedBox(height: spacing),
      itemBuilder: (context, index) {
        final item = items[index];
        if (isDesktop && desktopItemBuilder != null) {
          return desktopItemBuilder!(context, item);
        }
        if (!isDesktop && mobileItemBuilder != null) {
          return mobileItemBuilder!(context, item);
        }
        return itemBuilder(context, item, isDesktop);
      },
    );
  }
}

/// Desktop panel with header and content
class DesktopPanel extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;
  final List<Widget>? actions;
  final IconData? icon;
  final EdgeInsets? padding;
  final double? height;
  final bool scrollable;

  const DesktopPanel({
    super.key,
    required this.title,
    this.subtitle,
    required this.child,
    this.actions,
    this.icon,
    this.padding,
    this.height,
    this.scrollable = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    Widget content = child;
    if (scrollable) {
      content = SingleChildScrollView(
        padding: padding ?? const EdgeInsets.all(DesignTokens.space16),
        child: child,
      );
    } else if (padding != null) {
      content = Padding(padding: padding!, child: child);
    }

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(DesignTokens.radiusLg),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: DesignTokens.space16,
              vertical: DesignTokens.space12,
            ),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(DesignTokens.radiusLg),
                topRight: Radius.circular(DesignTokens.radiusLg),
              ),
            ),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    size: 20,
                    color: colorScheme.primary,
                  ),
                  const SizedBox(width: DesignTokens.space8),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                if (actions != null) ...actions!,
              ],
            ),
          ),
          // Content
          if (height != null)
            Expanded(child: content)
          else
            content,
        ],
      ),
    );
  }
}

/// Tab bar for desktop with horizontal scrolling
class DesktopTabBar extends StatelessWidget {
  final List<String> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTabSelected;
  final List<IconData>? icons;

  const DesktopTabBar({
    super.key,
    required this.tabs,
    required this.selectedIndex,
    required this.onTabSelected,
    this.icons,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withOpacity(0.3),
        borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(tabs.length, (index) {
          final isSelected = index == selectedIndex;
          return Padding(
            padding: EdgeInsets.only(left: index > 0 ? 4 : 0),
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
              child: InkWell(
                onTap: () => onTabSelected(index),
                borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                child: AnimatedContainer(
                  duration: DesignTokens.durationFast,
                  padding: const EdgeInsets.symmetric(
                    horizontal: DesignTokens.space16,
                    vertical: DesignTokens.space8,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? colorScheme.primary
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icons != null && index < icons!.length) ...[
                        Icon(
                          icons![index],
                          size: 18,
                          color: isSelected
                              ? colorScheme.onPrimary
                              : colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        tabs[index],
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: isSelected
                              ? colorScheme.onPrimary
                              : colorScheme.onSurfaceVariant,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
