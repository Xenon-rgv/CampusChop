// CampusChop - Delivery Zones Service (DELSU Abraka)
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const zonesService = {
  /**
   * Get active delivery zones for checkout and delivery calculation
   */
  async getActiveZones() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('fee', { ascending: true });

    if (error) {
      console.error('Error fetching active delivery zones:', error);
      return [];
    }
    return data || [];
  },

  /**
   * Get all zones for Administrator management
   */
  async getAllZonesAdmin() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching admin delivery zones:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new delivery zone (Admin only)
   */
  async createZone({ name, description, fee, estimatedDeliveryMinutes }) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('delivery_zones')
      .insert({
        name,
        description,
        fee: Number(fee),
        estimated_delivery_minutes: Number(estimatedDeliveryMinutes) || 30,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating delivery zone:', error);
      throw error;
    }
    return data;
  },

  /**
   * Update an existing delivery zone (Admin only)
   */
  async updateZone(id, updates) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('delivery_zones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery zone:', error);
      throw error;
    }
    return data;
  },
};
