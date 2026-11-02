// CampusChop - Cart Page Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { getCart, updateQuantity, removeFromCart, clearCart, getCartTotals } from '../utils/cart.js';
import { zonesService } from '../services/zones.service.js';
import { formatNaira, escapeHtml } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

let activeZones = [];
let fulfilmentMethod = 'delivery'; // 'delivery' or 'pickup'
let selectedZoneId = '';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  // Load active delivery zones
  try {
    activeZones = await zonesService.getActiveZones();
    if (activeZones.length > 0) {
      selectedZoneId = activeZones[0].id;
    }
  } catch (e) {
    console.error('Error loading zones for cart', e);
  }

  // Restore previous selections from sessionStorage if available
  const savedMethod = sessionStorage.getItem('campuschop_fulfilment_type');
  if (savedMethod) fulfilmentMethod = savedMethod;

  const savedZone = sessionStorage.getItem('campuschop_zone_id');
  if (savedZone && activeZones.some((z) => z.id === savedZone)) {
    selectedZoneId = savedZone;
  }

  setupEventListeners();
  renderCart();
});

const setupEventListeners = () => {
  // Fulfilment Toggle Buttons
  const deliveryBtn = document.getElementById('choose-delivery-btn');
  const pickupBtn = document.getElementById('choose-pickup-btn');
  const zoneWrap = document.getElementById('delivery-zone-wrap');
  const zoneSelect = document.getElementById('cart-zone-select');

  if (deliveryBtn && pickupBtn) {
    deliveryBtn.addEventListener('click', () => {
      fulfilmentMethod = 'delivery';
      sessionStorage.setItem('campuschop_fulfilment_type', 'delivery');
      deliveryBtn.className = 'btn btn-sm btn-primary';
      pickupBtn.className = 'btn btn-sm btn-outline';
      if (zoneWrap) zoneWrap.style.display = 'block';
      updateSummaryCalculations();
    });

    pickupBtn.addEventListener('click', () => {
      fulfilmentMethod = 'pickup';
      sessionStorage.setItem('campuschop_fulfilment_type', 'pickup');
      pickupBtn.className = 'btn btn-sm btn-primary';
      deliveryBtn.className = 'btn btn-sm btn-outline';
      if (zoneWrap) zoneWrap.style.display = 'none';
      updateSummaryCalculations();
    });
  }

  if (zoneSelect) {
    zoneSelect.addEventListener('change', (e) => {
      selectedZoneId = e.target.value;
      sessionStorage.setItem('campuschop_zone_id', selectedZoneId);
      updateSummaryCalculations();
    });
  }

  // Clear Cart
  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to empty your shopping cart?')) {
        clearCart();
        toast.info('Cart emptied.');
        renderCart();
      }
    });
  }

  // Listen for external cart changes
  window.addEventListener('campuschop:cart-updated', () => {
    renderCart();
  });
};

const renderCart = () => {
  const cart = getCart();
  const itemsContainer = document.getElementById('cart-items-container');
  const layout = document.getElementById('cart-content-layout');
  const clearBtn = document.getElementById('clear-cart-btn');
  const zoneSelect = document.getElementById('cart-zone-select');

  if (!itemsContainer) return;

  if (cart.items.length === 0) {
    if (clearBtn) clearBtn.style.display = 'none';
    layout.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; width: 100%;">
        <div class="empty-state-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Explore delicious campus meals from DELSU restaurants and add them to your cart.</p>
        <a href="/marketplace.html" class="btn btn-primary btn-lg">Explore Food Menu</a>
      </div>
    `;
    return;
  }

  if (clearBtn) clearBtn.style.display = 'inline-flex';

  // Populate zones dropdown
  if (zoneSelect) {
    if (activeZones.length === 0) {
      zoneSelect.innerHTML = `<option value="">Standard Campus Delivery (₦300.00)</option>`;
    } else {
      zoneSelect.innerHTML = activeZones.map((z) => `
        <option value="${z.id}" ${z.id === selectedZoneId ? 'selected' : ''}>
          ${escapeHtml(z.name)} — ${formatNaira(z.fee)} (~${z.estimated_delivery_minutes} mins)
        </option>
      `).join('');
    }
  }

  // Render Vendor Header & Line items
  const vendorName = cart.vendor?.name || 'Local Vendor';
  itemsContainer.innerHTML = `
    <div class="cart-vendor-banner">
      <div>
        <span style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Ordering from</span>
        <h4 style="margin:0; font-size:1.15rem; color:var(--text-main);">${escapeHtml(vendorName)}</h4>
      </div>
      <a href="/vendor.html?id=${cart.vendor?.id}" class="btn btn-sm btn-outline">
        View Store Menu
      </a>
    </div>
    <div class="cart-items-list">
      ${cart.items.map((item) => {
        const img = item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
        const lineTotal = Number(item.price) * Number(item.quantity);
        return `
          <div class="cart-item-row" data-id="${item.product_id}">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" class="cart-item-thumb">
            <div class="cart-item-info">
              <div class="cart-item-title">${escapeHtml(item.name)}</div>
              <div class="cart-item-unit-price">${formatNaira(item.price)} each</div>
              <div style="margin-top:0.5rem; display:flex; align-items:center; gap:0.75rem;">
                <div class="qty-stepper">
                  <button class="qty-btn btn-minus" data-id="${item.product_id}">&minus;</button>
                  <span class="qty-val">${item.quantity}</span>
                  <button class="qty-btn btn-plus" data-id="${item.product_id}">+</button>
                </div>
                <button class="btn btn-sm btn-ghost text-danger remove-item-btn" data-id="${item.product_id}" style="font-size:0.8rem; padding:0.2rem 0.5rem;">
                  Remove
                </button>
              </div>
            </div>
            <div class="cart-item-total">
              ${formatNaira(lineTotal)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Stepper & Remove Event Handlers
  itemsContainer.querySelectorAll('.btn-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = cart.items.find((i) => i.product_id === id);
      if (item) {
        updateQuantity(id, item.quantity - 1);
      }
    });
  });

  itemsContainer.querySelectorAll('.btn-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = cart.items.find((i) => i.product_id === id);
      if (item) {
        updateQuantity(id, item.quantity + 1);
      }
    });
  });

  itemsContainer.querySelectorAll('.remove-item-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeFromCart(btn.dataset.id);
      toast.info('Item removed from cart.');
    });
  });

  updateSummaryCalculations();
};

const updateSummaryCalculations = () => {
  let deliveryFee = 0;

  if (fulfilmentMethod === 'delivery') {
    const selectedZone = activeZones.find((z) => z.id === selectedZoneId);
    deliveryFee = selectedZone ? Number(selectedZone.fee) : (activeZones.length > 0 ? Number(activeZones[0].fee) : 300);
  }

  const totals = getCartTotals(deliveryFee);

  const subtotalEl = document.getElementById('summary-subtotal');
  const feeLabelEl = document.getElementById('summary-fee-label');
  const feeEl = document.getElementById('summary-fee');
  const totalEl = document.getElementById('summary-total');

  if (subtotalEl) subtotalEl.textContent = formatNaira(totals.subtotal);
  if (feeLabelEl) {
    feeLabelEl.textContent = fulfilmentMethod === 'delivery' ? 'Delivery Fee:' : 'Pickup:';
  }
  if (feeEl) {
    feeEl.textContent = fulfilmentMethod === 'delivery' ? formatNaira(deliveryFee) : 'FREE (₦0.00)';
  }
  if (totalEl) totalEl.textContent = formatNaira(totals.total);
};
