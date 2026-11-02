// CampusChop - Order Management & Realtime Service
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

export const ordersService = {
  /**
   * Create a new order with validated product prices and order item snapshots
   */
  async createOrder({
    vendorId,
    items,
    fulfilmentType,
    deliveryZoneId = null,
    deliveryAddress = '',
    deliveryPhone,
    deliveryInstructions = '',
    paymentMethod,
  }) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to place an order.');

    if (!items || items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    // 1. Fetch current live products from database to prevent browser price tampering
    const productIds = items.map((i) => i.product_id);
    const { data: liveProducts, error: prodErr } = await supabase
      .from('products')
      .select('id, name, price, is_available, vendor_id')
      .in('id', productIds);

    if (prodErr || !liveProducts) {
      throw new Error('Unable to verify meal availability. Please try again.');
    }

    // Validate availability and calculate verified subtotal
    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const live = liveProducts.find((p) => p.id === item.product_id);
      if (!live) {
        throw new Error(`Item "${item.name}" is no longer available.`);
      }
      if (!live.is_available) {
        throw new Error(`"${live.name}" is currently sold out.`);
      }
      if (live.vendor_id !== vendorId) {
        throw new Error('All items in an order must be from the same vendor.');
      }

      const qty = Math.max(1, Number(item.quantity));
      const unitPrice = Number(live.price);
      const itemTotal = unitPrice * qty;
      subtotal += itemTotal;

      verifiedItems.push({
        product_id: live.id,
        product_name_snapshot: live.name,
        unit_price_snapshot: unitPrice,
        quantity: qty,
        total_price: itemTotal,
        notes: item.notes || null,
      });
    }

    // 2. Validate delivery fee from delivery_zones if delivery selected
    let deliveryFee = 0;
    if (fulfilmentType === 'delivery') {
      if (!deliveryZoneId) {
        throw new Error('Please select a valid DELSU delivery zone.');
      }
      const { data: zone, error: zoneErr } = await supabase
        .from('delivery_zones')
        .select('fee, is_active')
        .eq('id', deliveryZoneId)
        .single();

      if (zoneErr || !zone || !zone.is_active) {
        throw new Error('The selected delivery zone is unavailable.');
      }
      deliveryFee = Number(zone.fee);
    }

    const totalAmount = subtotal + deliveryFee;

    // 3. Generate unique order reference
    const orderNumber = `CC-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

    // Initial status: online payments start at 'awaiting_payment' or 'pending', cash starts at 'pending'
    const orderStatus = paymentMethod === 'online' ? 'awaiting_payment' : 'pending';
    const paymentStatus = 'unpaid';

    // 4. Insert into 'orders' table
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: user.id,
        vendor_id: vendorId,
        fulfilment_type: fulfilmentType,
        delivery_zone_id: fulfilmentType === 'delivery' ? deliveryZoneId : null,
        delivery_address: deliveryAddress,
        delivery_phone: deliveryPhone,
        delivery_instructions: deliveryInstructions,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        order_status: orderStatus,
      })
      .select()
      .single();

    if (orderErr) {
      console.error('Error inserting order:', orderErr);
      throw orderErr;
    }

    // 5. Insert order item snapshots
    const orderItemsWithOrderId = verifiedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsErr) {
      console.error('Error inserting order items:', itemsErr);
      // Clean up order to prevent orphaned records
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsErr;
    }

    return order;
  },

  /**
   * Get all orders placed by the current customer
   */
  async getCustomerOrders() {
    if (!isSupabaseConfigured()) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        vendor:vendor_profiles (id, business_name, business_location, phone),
        delivery_zone:delivery_zones (name, fee),
        order_items (*)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer orders:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Get single order details with vendor and items
   */
  async getOrderById(orderId) {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles (full_name, email, phone),
        vendor:vendor_profiles (*),
        delivery_zone:delivery_zones (*),
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order by ID:', error);
      return null;
    }
    return data;
  },

  /**
   * Get orders assigned to a vendor
   */
  async getVendorOrders(vendorId) {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles (full_name, phone, email),
        delivery_zone:delivery_zones (name),
        order_items (*)
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vendor orders:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Admin: Get all orders across the platform
   */
  async getAllOrdersAdmin() {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles (full_name, phone, email),
        vendor:vendor_profiles (business_name),
        delivery_zone:delivery_zones (name),
        order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all orders for admin:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Update order status (Vendor or Admin)
   */
  async updateOrderStatus(orderId, newStatus, reason = null) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const payload = { order_status: newStatus };
    if (reason) payload.rejection_reason = reason;

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
    return data;
  },

  /**
   * Confirm cash payment received (Vendor or Admin)
   */
  async markCashReceived(orderId) {
    if (!isSupabaseConfigured()) throw new Error('Supabase not configured.');

    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'cash_received',
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error marking cash received:', error);
      throw error;
    }
    return data;
  },

  /**
   * Subscribe to real-time status updates for a specific order
   */
  subscribeToOrder(orderId, onUpdate) {
    if (!isSupabaseConfigured()) return () => {};

    const channel = supabase
      .channel(`order-updates-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (onUpdate) onUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to incoming orders for a vendor in real-time
   */
  subscribeToVendorOrders(vendorId, onNewOrder, onUpdateOrder) {
    if (!isSupabaseConfigured()) return () => {};

    const channel = supabase
      .channel(`vendor-orders-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          if (onNewOrder) onNewOrder(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          if (onUpdateOrder) onUpdateOrder(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
