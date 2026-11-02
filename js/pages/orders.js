// CampusChop - Customer Orders & Realtime Tracking Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { authService } from '../services/auth.service.js';
import { ordersService } from '../services/orders.service.js';
import { formatNaira, formatDate, getOrderStatusBadge, getPaymentStatusBadge, escapeHtml } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

let orders = [];
let realtimeUnsubscribers = [];

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  const authData = await authService.requireAuth([], '/login.html');
  if (!authData) return;

  const params = new URLSearchParams(window.location.search);
  const targetOrderId = params.get('orderId');

  await loadCustomerOrders(targetOrderId);
});

// Clean up realtime subscriptions when navigating away
window.addEventListener('beforeunload', () => {
  realtimeUnsubscribers.forEach((unsub) => unsub());
});

const loadCustomerOrders = async (targetOrderId) => {
  const container = document.getElementById('customer-orders-list');
  const focusCard = document.getElementById('live-order-focus-card');
  if (!container) return;

  try {
    orders = await ordersService.getCustomerOrders();

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h2>No orders yet</h2>
          <p>You haven't placed any food orders on CampusChop yet. Browse our DELSU vendors to discover amazing meals!</p>
          <a href="/marketplace.html" class="btn btn-primary btn-lg">Explore Food Menu</a>
        </div>
      `;
      return;
    }

    // Determine focused order
    let activeOrder = null;
    if (targetOrderId) {
      activeOrder = orders.find((o) => o.id === targetOrderId);
    }
    if (!activeOrder && orders.length > 0) {
      // Pick first non-completed/non-cancelled order if exists
      activeOrder = orders.find((o) => !['completed', 'cancelled', 'rejected'].includes(o.order_status));
    }

    // Render Focus Card with Realtime Tracker if an active order exists
    if (activeOrder && focusCard) {
      renderActiveOrderFocus(activeOrder);
      focusCard.style.display = 'block';

      // Setup Realtime Subscription for this active order
      const unsub = ordersService.subscribeToOrder(activeOrder.id, (updatedOrder) => {
        toast.info(`Order #${updatedOrder.order_number} status updated to ${updatedOrder.order_status.replace(/_/g, ' ')}!`);
        // Update local memory and re-render
        const idx = orders.findIndex((o) => o.id === updatedOrder.id);
        if (idx > -1) {
          orders[idx] = { ...orders[idx], ...updatedOrder };
          renderActiveOrderFocus(orders[idx]);
          renderOrdersList();
        }
      });
      realtimeUnsubscribers.push(unsub);
    }

    renderOrdersList();
  } catch (err) {
    console.error('Error loading orders:', err);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading orders</h3>
        <p>Please check your connection and Supabase configuration.</p>
      </div>
    `;
  }
};

const renderActiveOrderFocus = (order) => {
  const card = document.getElementById('live-order-focus-card');
  if (!card) return;

  const vendorName = order.vendor?.business_name || 'Campus Vendor';
  const isDelivery = order.fulfilment_type === 'delivery';

  // Tracker steps definition
  const steps = [
    { key: 'pending', label: 'Order Placed', icon: '📝' },
    { key: 'confirmed', label: 'Confirmed', icon: '👍' },
    { key: 'preparing', label: 'Kitchen Preparing', icon: '🍳' },
    { key: 'ready', label: isDelivery ? 'Ready for Courier' : 'Ready for Pickup', icon: '🍱' },
    { key: isDelivery ? 'out_for_delivery' : 'completed', label: isDelivery ? 'Out for Delivery' : 'Collected', icon: isDelivery ? '🛵' : '✅' },
    { key: 'completed', label: 'Completed', icon: '🎉' },
  ];

  // Calculate current active step index
  const statusRank = {
    pending: 0,
    awaiting_payment: 0,
    confirmed: 1,
    preparing: 2,
    ready: 3,
    out_for_delivery: 4,
    completed: 5,
    rejected: -1,
    cancelled: -1,
  };

  const currentRank = statusRank[order.order_status] ?? 0;
  const isTerminalNegative = ['rejected', 'cancelled'].includes(order.order_status);

  card.innerHTML = `
    <div class="card" style="border: 2px solid var(--primary); background: #FFFFFF; overflow: hidden; box-shadow: var(--shadow-lg);">
      <div style="background: var(--primary-subtle); padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid rgba(255,94,30,0.2);">
        <div>
          <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.05em;">
            ⚡ LIVE ORDER TRACKER
          </span>
          <h3 style="margin: 0; font-size: 1.35rem;">
            Order #${escapeHtml(order.order_number)}
          </h3>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          ${getOrderStatusBadge(order.order_status)}
          ${getPaymentStatusBadge(order.payment_status)}
        </div>
      </div>

      <div style="padding: 1.75rem 1.5rem;">
        ${isTerminalNegative ? `
          <div style="background: var(--danger-subtle); color: var(--danger); padding: 1rem; border-radius: var(--radius-md); font-weight: 600;">
            This order has been ${order.order_status}. ${order.rejection_reason ? `<br><small>Reason: ${escapeHtml(order.rejection_reason)}</small>` : ''}
          </div>
        ` : `
          <!-- Visual Stepper Progress Bar -->
          <div style="display: flex; justify-content: space-between; position: relative; margin-bottom: 2rem; overflow-x: auto; padding: 0.5rem 0;">
            ${steps.map((st, i) => {
              const isDone = currentRank >= i;
              const isCurrent = currentRank === i;
              return `
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 90px; text-align: center; position: relative; z-index: 2;">
                  <div style="width: 2.5rem; height: 2.5rem; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; background: ${isDone ? 'var(--primary)' : 'var(--bg-alt)'}; color: ${isDone ? '#FFF' : 'var(--text-muted)'}; box-shadow: ${isCurrent ? '0 0 0 4px var(--primary-subtle)' : 'none'}; transition: var(--transition); margin-bottom: 0.4rem;">
                    ${st.icon}
                  </div>
                  <span style="font-size: 0.75rem; font-weight: ${isCurrent ? '800' : '600'}; color: ${isDone ? 'var(--text-main)' : 'var(--text-muted)'};">
                    ${st.label}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; background: var(--bg-page); padding: 1.25rem; border-radius: var(--radius-md);">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Vendor</div>
            <div style="font-weight: 700; font-size: 1.05rem;">${escapeHtml(vendorName)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">📍 ${escapeHtml(order.vendor?.business_location || 'Abraka Campus')}</div>
          </div>

          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Destination</div>
            <div style="font-weight: 700;">${isDelivery ? 'Hostel Delivery' : 'Pickup at Vendor Counter'}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              ${isDelivery ? `${escapeHtml(order.delivery_zone?.name || 'Abraka')}: ${escapeHtml(order.delivery_address || '')}` : 'Collect at shop'}
            </div>
          </div>

          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Total Paid / Due</div>
            <div style="font-weight: 800; font-size: 1.25rem; color: var(--primary);">${formatNaira(order.total_amount)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize;">${order.payment_method.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const renderOrdersList = () => {
  const container = document.getElementById('customer-orders-list');
  if (!container) return;

  container.innerHTML = orders.map((order) => {
    const vendorName = order.vendor?.business_name || 'Campus Vendor';
    const items = order.order_items || [];
    const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);

    return `
      <div class="card card-hover" style="margin-bottom: 1.25rem;">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid var(--bg-alt); padding-bottom: 0.85rem;">
            <div>
              <div style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">
                ${escapeHtml(vendorName)}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                Order #${escapeHtml(order.order_number)} &bull; Placed ${formatDate(order.created_at)}
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              ${getOrderStatusBadge(order.order_status)}
              ${getPaymentStatusBadge(order.payment_status)}
            </div>
          </div>

          <!-- Order Items Snippet -->
          <div style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
            ${items.slice(0, 3).map((it) => `
              <div>• ${it.quantity}x ${escapeHtml(it.product_name_snapshot)} (${formatNaira(it.unit_price_snapshot)})</div>
            `).join('')}
            ${items.length > 3 ? `<div style="color:var(--text-muted); font-size:0.8rem;">+ ${items.length - 3} more items</div>` : ''}
          </div>

          <!-- Order Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.85rem; color: var(--text-muted);">Total (${itemCount} items): </span>
              <strong style="font-size: 1.1rem; color: var(--text-main);">${formatNaira(order.total_amount)}</strong>
            </div>

            <button class="btn btn-sm btn-outline view-track-btn" data-order-id="${order.id}">
              Track Live &rarr;
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Track Live buttons
  container.querySelectorAll('.view-track-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = orders.find((o) => o.id === btn.dataset.orderId);
      if (target) {
        renderActiveOrderFocus(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
};
