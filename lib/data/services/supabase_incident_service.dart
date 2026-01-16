import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_config.dart';
import '../../core/config/supabase_service.dart';
import '../../domain/entities/models/incident_model.dart';

/// Supabase service for incident operations
class SupabaseIncidentService {
  final SupabaseClient _client = SupabaseService.client;

  /// Get all incidents
  Future<List<IncidentModel>> getAllIncidents({
    IncidentStatus? status,
    IncidentSeverity? severity,
    int limit = 100,
  }) async {
    try {
      var query = _client.from(SupabaseConfig.incidentsTable).select();

      if (status != null) {
        query = query.eq('status', status.dbValue);
      }
      if (severity != null) {
        query = query.eq('severity', severity.name);
      }

      final response = await query
          .order('created_at', ascending: false)
          .limit(limit);

      return (response as List)
          .map((json) => IncidentModel.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching incidents: $e');
      return [];
    }
  }

  /// Get open incidents
  Future<List<IncidentModel>> getOpenIncidents() async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .select()
          .inFilter('status', ['open', 'acknowledged', 'in_progress'])
          .order('severity')
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => IncidentModel.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching open incidents: $e');
      return [];
    }
  }

  /// Get incidents by device
  Future<List<IncidentModel>> getDeviceIncidents(String deviceId) async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .select()
          .eq('device_id', deviceId)
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => IncidentModel.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching device incidents: $e');
      return [];
    }
  }

  /// Get incident by ID
  Future<IncidentModel?> getIncidentById(String id) async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .select()
          .eq('id', id)
          .single();

      return IncidentModel.fromJson(response);
    } catch (e) {
      print('Error fetching incident: $e');
      return null;
    }
  }

  /// Create new incident
  Future<IncidentModel?> createIncident(IncidentModel incident) async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .insert(incident.toInsertJson())
          .select()
          .single();

      return IncidentModel.fromJson(response);
    } catch (e) {
      print('Error creating incident: $e');
      return null;
    }
  }

  /// Update incident status
  Future<IncidentModel?> updateIncidentStatus(
    String id,
    IncidentStatus status, {
    DateTime? resolvedAt,
  }) async {
    try {
      final updates = <String, dynamic>{'status': status.dbValue};
      if (status == IncidentStatus.resolved || status == IncidentStatus.closed) {
        updates['resolved_at'] = (resolvedAt ?? DateTime.now()).toIso8601String();
      }

      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

      return IncidentModel.fromJson(response);
    } catch (e) {
      print('Error updating incident status: $e');
      return null;
    }
  }

  /// Assign incident to user
  Future<IncidentModel?> assignIncident(String id, String userId) async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .update({'assigned_to': userId})
          .eq('id', id)
          .select()
          .single();

      return IncidentModel.fromJson(response);
    } catch (e) {
      print('Error assigning incident: $e');
      return null;
    }
  }

  /// Update incident
  Future<IncidentModel?> updateIncident(String id, Map<String, dynamic> updates) async {
    try {
      final response = await _client
          .from(SupabaseConfig.incidentsTable)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

      return IncidentModel.fromJson(response);
    } catch (e) {
      print('Error updating incident: $e');
      return null;
    }
  }

  /// Delete incident
  Future<bool> deleteIncident(String id) async {
    try {
      await _client
          .from(SupabaseConfig.incidentsTable)
          .delete()
          .eq('id', id);

      return true;
    } catch (e) {
      print('Error deleting incident: $e');
      return false;
    }
  }

  /// Get incident statistics
  Future<Map<String, int>> getIncidentStats() async {
    try {
      final all = await getAllIncidents();
      
      return {
        'total': all.length,
        'open': all.where((i) => i.status == IncidentStatus.open).length,
        'acknowledged': all.where((i) => i.status == IncidentStatus.acknowledged).length,
        'inProgress': all.where((i) => i.status == IncidentStatus.inProgress).length,
        'resolved': all.where((i) => i.status == IncidentStatus.resolved).length,
        'closed': all.where((i) => i.status == IncidentStatus.closed).length,
        'critical': all.where((i) => i.severity == IncidentSeverity.critical).length,
        'high': all.where((i) => i.severity == IncidentSeverity.high).length,
      };
    } catch (e) {
      print('Error getting incident stats: $e');
      return {};
    }
  }

  /// Subscribe to incident changes (realtime)
  RealtimeChannel subscribeToIncidents(void Function(List<IncidentModel>) onData) {
    return _client
        .channel('incidents-changes')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: SupabaseConfig.incidentsTable,
          callback: (payload) async {
            final incidents = await getAllIncidents();
            onData(incidents);
          },
        )
        .subscribe();
  }
}
