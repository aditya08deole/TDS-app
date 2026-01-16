import 'package:flutter/material.dart';
import 'responsive_breakpoints.dart';

/// Responsive wrapper that provides different layouts based on screen size
class ResponsiveWrapper extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;
  final Widget? desktopLarge;

  const ResponsiveWrapper({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
    this.desktopLarge,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;

        if (width >= ResponsiveBreakpoints.desktopLarge && desktopLarge != null) {
          return desktopLarge!;
        }
        if (width >= ResponsiveBreakpoints.desktop && desktop != null) {
          return desktop!;
        }
        if (width >= ResponsiveBreakpoints.tablet && tablet != null) {
          return tablet!;
        }
        return mobile;
      },
    );
  }
}

/// Responsive grid that automatically adjusts columns
class ResponsiveGrid extends StatelessWidget {
  final List<Widget> children;
  final double spacing;
  final double runSpacing;
  final int? mobileColumns;
  final int? tabletColumns;
  final int? desktopColumns;
  final int? desktopLargeColumns;

  const ResponsiveGrid({
    super.key,
    required this.children,
    this.spacing = 16,
    this.runSpacing = 16,
    this.mobileColumns,
    this.tabletColumns,
    this.desktopColumns,
    this.desktopLargeColumns,
  });

  @override
  Widget build(BuildContext context) {
    final columns = ResponsiveBreakpoints.responsive<int>(
      context,
      mobile: mobileColumns ?? 1,
      tablet: tabletColumns ?? 2,
      desktop: desktopColumns ?? 3,
      desktopLarge: desktopLargeColumns ?? 4,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - (columns - 1) * spacing) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: runSpacing,
          children: children.map((child) {
            return SizedBox(
              width: itemWidth,
              child: child,
            );
          }).toList(),
        );
      },
    );
  }
}

/// Responsive container that constrains content width on large screens
class ResponsiveContainer extends StatelessWidget {
  final Widget child;
  final double? maxWidth;
  final EdgeInsets? padding;
  final bool center;

  const ResponsiveContainer({
    super.key,
    required this.child,
    this.maxWidth,
    this.padding,
    this.center = true,
  });

  @override
  Widget build(BuildContext context) {
    final contentMaxWidth = maxWidth ?? ResponsiveBreakpoints.getContentMaxWidth(context);
    final horizontalPadding = ResponsiveBreakpoints.getHorizontalPadding(context);

    Widget content = child;

    if (padding != null) {
      content = Padding(padding: padding!, child: content);
    }

    if (center) {
      return Center(
        child: Container(
          constraints: BoxConstraints(maxWidth: contentMaxWidth),
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: content,
        ),
      );
    }

    return Container(
      constraints: BoxConstraints(maxWidth: contentMaxWidth),
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
      child: content,
    );
  }
}

/// Responsive visibility - shows/hides widgets based on screen size
class ResponsiveVisibility extends StatelessWidget {
  final Widget child;
  final bool visibleOnMobile;
  final bool visibleOnTablet;
  final bool visibleOnDesktop;
  final Widget? replacement;

  const ResponsiveVisibility({
    super.key,
    required this.child,
    this.visibleOnMobile = true,
    this.visibleOnTablet = true,
    this.visibleOnDesktop = true,
    this.replacement,
  });

  @override
  Widget build(BuildContext context) {
    final deviceType = ResponsiveBreakpoints.getDeviceType(context);

    bool isVisible = false;
    switch (deviceType) {
      case DeviceType.mobile:
        isVisible = visibleOnMobile;
        break;
      case DeviceType.tablet:
        isVisible = visibleOnTablet;
        break;
      case DeviceType.desktop:
      case DeviceType.desktopLarge:
      case DeviceType.desktopXL:
        isVisible = visibleOnDesktop;
        break;
    }

    if (isVisible) {
      return child;
    }

    return replacement ?? const SizedBox.shrink();
  }
}

/// Responsive spacing
class ResponsiveSpacing extends StatelessWidget {
  final double? mobileSpacing;
  final double? tabletSpacing;
  final double? desktopSpacing;
  final Axis axis;

  const ResponsiveSpacing({
    super.key,
    this.mobileSpacing = 16,
    this.tabletSpacing,
    this.desktopSpacing,
    this.axis = Axis.vertical,
  });

  @override
  Widget build(BuildContext context) {
    final spacing = ResponsiveBreakpoints.responsive<double>(
      context,
      mobile: mobileSpacing ?? 16,
      tablet: tabletSpacing,
      desktop: desktopSpacing,
    );

    if (axis == Axis.vertical) {
      return SizedBox(height: spacing);
    }
    return SizedBox(width: spacing);
  }
}
