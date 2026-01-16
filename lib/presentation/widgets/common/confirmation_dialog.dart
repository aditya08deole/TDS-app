import 'package:flutter/material.dart';
import '../../../core/theme/design_tokens.dart';

/// Error-resistant confirmation dialog for high-impact actions
/// Prevents accidental destructive operations
class ConfirmationDialog extends StatelessWidget {
  final String title;
  final String description;
  final String? consequences;
  final String confirmLabel;
  final String cancelLabel;
  final Color? confirmColor;
  final IconData? icon;
  final bool isDestructive;
  final VoidCallback onConfirm;
  final VoidCallback? onCancel;

  const ConfirmationDialog({
    super.key,
    required this.title,
    required this.description,
    this.consequences,
    this.confirmLabel = 'Confirm',
    this.cancelLabel = 'Cancel',
    this.confirmColor,
    this.icon,
    this.isDestructive = false,
    required this.onConfirm,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = confirmColor ?? 
        (isDestructive ? Theme.of(context).colorScheme.error : Theme.of(context).colorScheme.primary);

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusLg)),
      title: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, color: effectiveColor, size: 24),
            const SizedBox(width: DesignTokens.space12),
          ],
          Expanded(child: Text(title)),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(description),
          if (consequences != null) ...[
            const SizedBox(height: DesignTokens.space16),
            Container(
              padding: const EdgeInsets.all(DesignTokens.space12),
              decoration: BoxDecoration(
                color: effectiveColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(DesignTokens.radiusSm),
                border: Border.all(color: effectiveColor.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_outlined, color: effectiveColor, size: 18),
                  const SizedBox(width: DesignTokens.space8),
                  Expanded(
                    child: Text(
                      consequences!,
                      style: Theme.of(context).textTheme.bodySmall!.copyWith(
                            color: effectiveColor,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(context).pop();
            onCancel?.call();
          },
          child: Text(cancelLabel),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.of(context).pop();
            onConfirm();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: effectiveColor,
            foregroundColor: Colors.white,
          ),
          child: Text(confirmLabel),
        ),
      ],
    );
  }

  static Future<bool> show({
    required BuildContext context,
    required String title,
    required String description,
    String? consequences,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    bool isDestructive = false,
    IconData? icon,
  }) async {
    bool confirmed = false;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => ConfirmationDialog(
        title: title,
        description: description,
        consequences: consequences,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        isDestructive: isDestructive,
        icon: icon,
        onConfirm: () => confirmed = true,
      ),
    );
    return confirmed;
  }
}
