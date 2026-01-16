import 'package:flutter/material.dart';
import '../../core/responsive/responsive_breakpoints.dart';
import '../../core/theme/design_tokens.dart';

/// A responsive page scaffold that adapts to desktop layouts
class ResponsivePage extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final bool showHeader;
  final bool constrainWidth;
  final double? maxWidth;
  final EdgeInsets? padding;
  final Color? backgroundColor;

  const ResponsivePage({
    super.key,
    this.title,
    this.subtitle,
    required this.body,
    this.actions,
    this.floatingActionButton,
    this.showHeader = false,
    this.constrainWidth = true,
    this.maxWidth,
    this.padding,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);
    final colorScheme = Theme.of(context).colorScheme;

    Widget content = body;

    // Add padding for desktop
    if (isDesktop && constrainWidth) {
      final contentMaxWidth = maxWidth ?? ResponsiveBreakpoints.getContentMaxWidth(context);
      content = Center(
        child: Container(
          constraints: BoxConstraints(maxWidth: contentMaxWidth),
          padding: padding ?? const EdgeInsets.all(DesignTokens.space24),
          child: content,
        ),
      );
    } else {
      content = Padding(
        padding: padding ?? const EdgeInsets.all(DesignTokens.space16),
        child: content,
      );
    }

    // Add header if needed
    if (showHeader && title != null) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildPageHeader(context),
          Expanded(child: content),
        ],
      );
    }

    return Scaffold(
      backgroundColor: backgroundColor ?? Colors.transparent,
      body: content,
      floatingActionButton: floatingActionButton,
    );
  }

  Widget _buildPageHeader(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isDesktop ? DesignTokens.space32 : DesignTokens.space16,
        vertical: DesignTokens.space16,
      ),
      decoration: BoxDecoration(
        color: colorScheme.surface.withOpacity(0.5),
        border: Border(
          bottom: BorderSide(
            color: colorScheme.outlineVariant.withOpacity(0.3),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title!,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (actions != null) ...actions!,
        ],
      ),
    );
  }
}

/// Responsive card grid for dashboard layouts
class ResponsiveCardGrid extends StatelessWidget {
  final List<Widget> cards;
  final int minCrossAxisCount;
  final int maxCrossAxisCount;
  final double spacing;
  final double childAspectRatio;

  const ResponsiveCardGrid({
    super.key,
    required this.cards,
    this.minCrossAxisCount = 1,
    this.maxCrossAxisCount = 4,
    this.spacing = 16,
    this.childAspectRatio = 1.4,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate optimal column count based on available width
        final availableWidth = constraints.maxWidth;
        final minCardWidth = 280.0;
        final maxCardWidth = 400.0;
        
        int columns = (availableWidth / minCardWidth).floor();
        columns = columns.clamp(minCrossAxisCount, maxCrossAxisCount);
        
        // Ensure cards don't get too wide
        final cardWidth = (availableWidth - (columns - 1) * spacing) / columns;
        if (cardWidth > maxCardWidth && columns < maxCrossAxisCount) {
          columns = ((availableWidth + spacing) / (maxCardWidth + spacing)).floor();
          columns = columns.clamp(minCrossAxisCount, maxCrossAxisCount);
        }

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: spacing,
            mainAxisSpacing: spacing,
            childAspectRatio: childAspectRatio,
          ),
          itemCount: cards.length,
          itemBuilder: (context, index) => cards[index],
        );
      },
    );
  }
}

/// Responsive two-column layout for desktop
class ResponsiveTwoColumn extends StatelessWidget {
  final Widget primary;
  final Widget secondary;
  final double primaryFlex;
  final double secondaryFlex;
  final double spacing;
  final bool stackOnMobile;

  const ResponsiveTwoColumn({
    super.key,
    required this.primary,
    required this.secondary,
    this.primaryFlex = 2,
    this.secondaryFlex = 1,
    this.spacing = 24,
    this.stackOnMobile = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDesktop = ResponsiveBreakpoints.isDesktop(context);

    if (!isDesktop && stackOnMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          primary,
          SizedBox(height: spacing),
          secondary,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: primaryFlex.toInt(),
          child: primary,
        ),
        SizedBox(width: spacing),
        Expanded(
          flex: secondaryFlex.toInt(),
          child: secondary,
        ),
      ],
    );
  }
}

/// Responsive three-column layout for dashboard
class ResponsiveThreeColumn extends StatelessWidget {
  final Widget left;
  final Widget center;
  final Widget right;
  final double spacing;

  const ResponsiveThreeColumn({
    super.key,
    required this.left,
    required this.center,
    required this.right,
    this.spacing = 24,
  });

  @override
  Widget build(BuildContext context) {
    final deviceType = ResponsiveBreakpoints.getDeviceType(context);

    if (deviceType == DeviceType.mobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          left,
          SizedBox(height: spacing),
          center,
          SizedBox(height: spacing),
          right,
        ],
      );
    }

    if (deviceType == DeviceType.tablet) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: left),
              SizedBox(width: spacing),
              Expanded(child: center),
            ],
          ),
          SizedBox(height: spacing),
          right,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: left),
        SizedBox(width: spacing),
        Expanded(flex: 2, child: center),
        SizedBox(width: spacing),
        Expanded(child: right),
      ],
    );
  }
}
