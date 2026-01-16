import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:ui';
import '../../core/theme/app_colors.dart';
import '../../core/theme/design_tokens.dart';
import '../../domain/entities/models/device_model.dart';
import '../../domain/entities/device_status.dart';
import '../../data/services/device_data_service.dart';
import '../../data/services/thingspeak_service.dart';
import '../providers/supabase_providers.dart';

/// Device management page for adding and editing devices
class DeviceManagementPage extends ConsumerStatefulWidget {
  final DeviceModel? device; // null for new device

  const DeviceManagementPage({super.key, this.device});

  @override
  ConsumerState<DeviceManagementPage> createState() => _DeviceManagementPageState();
}

class _DeviceManagementPageState extends ConsumerState<DeviceManagementPage> {
  final _formKey = GlobalKey<FormState>();
  final _deviceDataService = DeviceDataService();
  final _thingspeakService = ThingSpeakService();

  // Controllers
  late final TextEditingController _deviceIdController;
  late final TextEditingController _nameController;
  late final TextEditingController _locationController;
  late final TextEditingController _latitudeController;
  late final TextEditingController _longitudeController;
  late final TextEditingController _simNumberController;
  late final TextEditingController _apiKeyController;
  late final TextEditingController _channelIdController;
  late final TextEditingController _warningThresholdController;
  late final TextEditingController _criticalThresholdController;

  // Field numbers
  int _tdsFieldNumber = 1;
  int? _temperatureFieldNumber;
  int? _voltageFieldNumber;

  bool _isLoading = false;
  bool _isTesting = false;
  String? _testResult;
  bool _testSuccess = false;

  bool get isEditing => widget.device != null;

  @override
  void initState() {
    super.initState();
    final device = widget.device;

    _deviceIdController = TextEditingController(text: device?.deviceId ?? '');
    _nameController = TextEditingController(text: device?.name ?? '');
    _locationController = TextEditingController(text: device?.location ?? '');
    _latitudeController = TextEditingController(
      text: device?.latitude.toString() ?? '',
    );
    _longitudeController = TextEditingController(
      text: device?.longitude.toString() ?? '',
    );
    _simNumberController = TextEditingController(text: device?.simNumber ?? '');
    _apiKeyController = TextEditingController(text: device?.thingspeakApiKey ?? '');
    _channelIdController = TextEditingController(text: device?.thingspeakChannelId ?? '');
    _warningThresholdController = TextEditingController(
      text: (device?.warningThreshold ?? 300).toString(),
    );
    _criticalThresholdController = TextEditingController(
      text: (device?.criticalThreshold ?? 600).toString(),
    );

    _tdsFieldNumber = device?.tdsFieldNumber ?? 1;
    _temperatureFieldNumber = device?.temperatureFieldNumber;
    _voltageFieldNumber = device?.voltageFieldNumber;
  }

  @override
  void dispose() {
    _deviceIdController.dispose();
    _nameController.dispose();
    _locationController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    _simNumberController.dispose();
    _apiKeyController.dispose();
    _channelIdController.dispose();
    _warningThresholdController.dispose();
    _criticalThresholdController.dispose();
    super.dispose();
  }

  Future<void> _testThingSpeakConnection() async {
    if (_apiKeyController.text.isEmpty) {
      setState(() {
        _testResult = 'Please enter a Read API Key first';
        _testSuccess = false;
      });
      return;
    }

    setState(() {
      _isTesting = true;
      _testResult = null;
    });

    try {
      final config = ThingSpeakConfig(
        readApiKey: _apiKeyController.text.trim(),
        channelId: _channelIdController.text.isNotEmpty 
            ? _channelIdController.text.trim() 
            : null,
        tdsFieldNumber: _tdsFieldNumber,
        temperatureFieldNumber: _temperatureFieldNumber,
        voltageFieldNumber: _voltageFieldNumber,
      );

      final reading = await _thingspeakService.getDeviceReading(config);

      if (reading != null) {
        setState(() {
          _testSuccess = true;
          _testResult = 'Connection successful!\n'
              'TDS: ${reading.tdsValue?.toStringAsFixed(1) ?? "N/A"} ppm\n'
              'Temperature: ${reading.temperature?.toStringAsFixed(1) ?? "N/A"} °C\n'
              'Voltage: ${reading.voltage?.toStringAsFixed(2) ?? "N/A"} V\n'
              'Timestamp: ${reading.timestamp.toLocal()}';
        });
      } else {
        setState(() {
          _testSuccess = false;
          _testResult = 'Failed to fetch data. Check API key and field numbers.';
        });
      }
    } catch (e) {
      setState(() {
        _testSuccess = false;
        _testResult = 'Error: $e';
      });
    } finally {
      setState(() {
        _isTesting = false;
      });
    }
  }

  Future<void> _saveDevice() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final currentUser = ref.read(currentSupabaseUserProvider);
      final now = DateTime.now();

      final deviceData = DeviceModel(
        id: widget.device?.id ?? '',
        deviceId: _deviceIdController.text.trim(),
        name: _nameController.text.trim(),
        location: _locationController.text.trim(),
        latitude: double.parse(_latitudeController.text.trim()),
        longitude: double.parse(_longitudeController.text.trim()),
        status: widget.device?.status ?? DeviceStatus.offline,
        currentTds: widget.device?.currentTds ?? 0,
        temperature: widget.device?.temperature,
        voltage: widget.device?.voltage,
        batteryLevel: widget.device?.batteryLevel ?? 100,
        isActive: true,
        createdBy: currentUser?.email,
        createdAt: widget.device?.createdAt ?? now,
        updatedAt: now,
        simNumber: _simNumberController.text.isNotEmpty 
            ? _simNumberController.text.trim() 
            : null,
        thingspeakApiKey: _apiKeyController.text.isNotEmpty 
            ? _apiKeyController.text.trim() 
            : null,
        thingspeakChannelId: _channelIdController.text.isNotEmpty 
            ? _channelIdController.text.trim() 
            : null,
        tdsFieldNumber: _tdsFieldNumber,
        temperatureFieldNumber: _temperatureFieldNumber,
        voltageFieldNumber: _voltageFieldNumber,
        warningThreshold: double.parse(_warningThresholdController.text.trim()),
        criticalThreshold: double.parse(_criticalThresholdController.text.trim()),
      );

      DeviceModel? result;
      if (isEditing) {
        result = await _deviceDataService.updateDevice(
          widget.device!.id,
          deviceData.toInsertJson(),
        );
      } else {
        result = await _deviceDataService.createDevice(deviceData);
      }

      if (result != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEditing ? 'Device updated successfully' : 'Device created successfully'),
            backgroundColor: AppColors.statusNormal,
          ),
        );
        Navigator.of(context).pop(result);
      }
    } catch (e) {
      if (mounted) {
        // Show detailed error message
        String errorMessage = e.toString();
        if (errorMessage.contains('relation "devices" does not exist')) {
          errorMessage = 'Database table not found! Please run the SQL setup in Supabase first.';
        } else if (errorMessage.contains('violates row-level security')) {
          errorMessage = 'Permission denied. Please check RLS policies in Supabase.';
        } else if (errorMessage.contains('duplicate key')) {
          errorMessage = 'A device with this ID already exists.';
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $errorMessage'),
            backgroundColor: AppColors.statusCritical,
            duration: const Duration(seconds: 8),
            action: SnackBarAction(
              label: 'DISMISS',
              textColor: Colors.white,
              onPressed: () {},
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDesktop = MediaQuery.of(context).size.width > 900;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Device' : 'Add Device'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton.icon(
              onPressed: _saveDevice,
              icon: const Icon(Icons.save),
              label: const Text('Save'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primaryCyan,
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: EdgeInsets.all(isDesktop ? 32 : 16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader('Device Information'),
                  const SizedBox(height: 16),
                  _buildBasicInfoCard(colorScheme),
                  const SizedBox(height: 24),

                  _buildSectionHeader('Location'),
                  const SizedBox(height: 16),
                  _buildLocationCard(colorScheme),
                  const SizedBox(height: 24),

                  _buildSectionHeader('ThingSpeak Configuration'),
                  const SizedBox(height: 16),
                  _buildThingSpeakCard(colorScheme),
                  const SizedBox(height: 24),

                  _buildSectionHeader('Thresholds'),
                  const SizedBox(height: 16),
                  _buildThresholdsCard(colorScheme),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.bold,
        color: AppColors.primaryCyan,
      ),
    );
  }

  Widget _buildBasicInfoCard(ColorScheme colorScheme) {
    return _buildGlassCard(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _deviceIdController,
                  decoration: _glassInputDecoration(
                    labelText: 'Device ID *',
                    hintText: 'Hardware identifier',
                    prefixIcon: Icons.qr_code,
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Device ID is required';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _nameController,
                  decoration: _glassInputDecoration(
                    labelText: 'Device Name *',
                    hintText: 'Display name',
                    prefixIcon: Icons.label_outline,
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Name is required';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _locationController,
            decoration: _glassInputDecoration(
              labelText: 'Location *',
              hintText: 'e.g., Kadamba Mess',
              prefixIcon: Icons.location_on_outlined,
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Location is required';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _simNumberController,
            decoration: _glassInputDecoration(
              labelText: 'SIM Number',
              hintText: 'SIM card number (optional)',
              prefixIcon: Icons.sim_card_outlined,
            ),
            keyboardType: TextInputType.phone,
          ),
        ],
      ),
    );
  }

  Widget _buildLocationCard(ColorScheme colorScheme) {
    return _buildGlassCard(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _latitudeController,
                  decoration: _glassInputDecoration(
                    labelText: 'Latitude *',
                    hintText: 'e.g., 17.4449',
                    prefixIcon: Icons.my_location,
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^-?\d*\.?\d*')),
                  ],
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Latitude is required';
                    }
                    final lat = double.tryParse(value);
                    if (lat == null || lat < -90 || lat > 90) {
                      return 'Invalid latitude (-90 to 90)';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _longitudeController,
                  decoration: _glassInputDecoration(
                    labelText: 'Longitude *',
                    hintText: 'e.g., 78.3489',
                    prefixIcon: Icons.my_location,
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^-?\d*\.?\d*')),
                  ],
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Longitude is required';
                    }
                    final lng = double.tryParse(value);
                    if (lng == null || lng < -180 || lng > 180) {
                      return 'Invalid longitude (-180 to 180)';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Tip: You can get coordinates from Google Maps by right-clicking on the location.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThingSpeakCard(ColorScheme colorScheme) {
    return _buildGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: _apiKeyController,
                  decoration: _glassInputDecoration(
                    labelText: 'Read API Key *',
                    hintText: 'ThingSpeak Read API Key',
                    prefixIcon: Icons.key,
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'API Key is required for data fetching';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _channelIdController,
                  decoration: _glassInputDecoration(
                    labelText: 'Channel ID',
                    hintText: 'Optional',
                    prefixIcon: Icons.tag,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          Text(
            'Field Mapping',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildFieldDropdown(
                  label: 'TDS Field *',
                  value: _tdsFieldNumber,
                  onChanged: (v) => setState(() => _tdsFieldNumber = v ?? 1),
                  required: true,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildFieldDropdown(
                  label: 'Temperature Field',
                  value: _temperatureFieldNumber,
                  onChanged: (v) => setState(() => _temperatureFieldNumber = v),
                  required: false,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildFieldDropdown(
                  label: 'Voltage Field',
                  value: _voltageFieldNumber,
                  onChanged: (v) => setState(() => _voltageFieldNumber = v),
                  required: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Test Connection Button
          Row(
            children: [
              _buildNeonButton(
                onPressed: _isTesting ? null : _testThingSpeakConnection,
                icon: _isTesting 
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(Icons.wifi_tethering, size: 18),
                label: _isTesting ? 'Testing...' : 'Test Connection',
              ),
              if (_testResult != null) ...[
                const SizedBox(width: 16),
                Icon(
                  _testSuccess ? Icons.check_circle : Icons.error,
                  color: _testSuccess ? AppColors.statusNormal : AppColors.statusCritical,
                ),
              ],
            ],
          ),

          if (_testResult != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (_testSuccess ? AppColors.statusNormal : AppColors.statusCritical)
                    .withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: (_testSuccess ? AppColors.statusNormal : AppColors.statusCritical)
                      .withOpacity(0.4),
                ),
              ),
              child: Text(
                _testResult!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primaryCyan.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primaryCyan.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.primaryCyan, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Data validation: Negative temperature/voltage and TDS < 20 ppm will be automatically ignored.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.primaryCyan,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThresholdsCard(ColorScheme colorScheme) {
    return _buildGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _warningThresholdController,
                  decoration: _glassInputDecoration(
                    labelText: 'Warning Threshold (ppm)',
                    hintText: '300',
                    prefixIcon: Icons.warning_amber,
                    prefixIconColor: AppColors.statusWarning,
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  validator: (value) {
                    if (value == null || value.isEmpty) return 'Required';
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _criticalThresholdController,
                  decoration: _glassInputDecoration(
                    labelText: 'Critical Threshold (ppm)',
                    hintText: '600',
                    prefixIcon: Icons.error,
                    prefixIconColor: AppColors.statusCritical,
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  validator: (value) {
                    if (value == null || value.isEmpty) return 'Required';
                    final critical = int.tryParse(value) ?? 0;
                    final warning = int.tryParse(_warningThresholdController.text) ?? 0;
                    if (critical <= warning) {
                      return 'Must be > warning';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildThresholdLegend(),
        ],
      ),
    );
  }

  // Helper: Glassy Card
  Widget _buildGlassCard({required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withOpacity(0.1),
                Colors.white.withOpacity(0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withOpacity(0.15),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }

  // Helper: Glass Input Decoration
  InputDecoration _glassInputDecoration({
    required String labelText,
    String? hintText,
    IconData? prefixIcon,
    Color? prefixIconColor,
  }) {
    return InputDecoration(
      labelText: labelText,
      hintText: hintText,
      labelStyle: TextStyle(color: AppColors.textSecondary),
      hintStyle: TextStyle(color: AppColors.textTertiary),
      prefixIcon: prefixIcon != null 
          ? Icon(prefixIcon, color: prefixIconColor ?? AppColors.primaryCyan.withOpacity(0.7))
          : null,
      filled: true,
      fillColor: Colors.white.withOpacity(0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryCyan, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  // Helper: Neon Button
  Widget _buildNeonButton({
    VoidCallback? onPressed,
    required Widget icon,
    required String label,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryCyan.withOpacity(0.4),
            blurRadius: 15,
            spreadRadius: -3,
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: icon,
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryCyan,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  Widget _buildThresholdLegend() {
    return Row(
      children: [
        _buildLegendItem(AppColors.statusNormal, 'Normal', '< Warning'),
        const SizedBox(width: 24),
        _buildLegendItem(AppColors.statusWarning, 'Warning', 'Warning - Critical'),
        const SizedBox(width: 24),
        _buildLegendItem(AppColors.statusCritical, 'Critical', '≥ Critical'),
      ],
    );
  }

  Widget _buildFieldDropdown({
    required String label,
    required int? value,
    required void Function(int?) onChanged,
    required bool required,
  }) {
    final items = <DropdownMenuItem<int?>>[];
    
    if (!required) {
      items.add(const DropdownMenuItem<int?>(
        value: null,
        child: Text('None'),
      ));
    }

    for (int i = 1; i <= 8; i++) {
      items.add(DropdownMenuItem<int?>(
        value: i,
        child: Text('Field $i'),
      ));
    }

    return DropdownButtonFormField<int?>(
      value: value,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: AppColors.textSecondary),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primaryCyan, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      dropdownColor: AppColors.surfaceDark,
      items: items,
      onChanged: onChanged,
      validator: required
          ? (v) => v == null ? 'Required' : null
          : null,
    );
  }

  Widget _buildLegendItem(Color color, String label, String range) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
            Text(range, style: TextStyle(fontSize: 10, color: Colors.grey[600])),
          ],
        ),
      ],
    );
  }
}
