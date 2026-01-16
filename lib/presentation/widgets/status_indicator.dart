import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../domain/entities/device_status.dart';

/// Status indicator with animated glow effect
class StatusIndicator extends StatefulWidget {
  final DeviceStatus status;
  final double size;
  final bool showLabel;

  const StatusIndicator({
    super.key,
    required this.status,
    this.size = 12,
    this.showLabel = false,
  });

  @override
  State<StatusIndicator> createState() => _StatusIndicatorState();
}

class _StatusIndicatorState extends State<StatusIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color _getStatusColor() {
    switch (widget.status) {
      case DeviceStatus.online:
        return AppColors.statusNormal;
      case DeviceStatus.warning:
        return AppColors.statusWarning;
      case DeviceStatus.critical:
        return AppColors.statusCritical;
      case DeviceStatus.offline:
        return AppColors.statusOffline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getStatusColor();

    if (widget.showLabel) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildIndicator(color),
          const SizedBox(width: 8),
          Text(
            widget.status.displayName,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      );
    }

    return _buildIndicator(color);
  }

  Widget _buildIndicator(Color color) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.6 * _controller.value),
                blurRadius: widget.size * (0.8 + 0.4 * _controller.value),
                spreadRadius: widget.size * (0.2 * _controller.value),
              ),
            ],
          ),
        );
      },
    );
  }
}
