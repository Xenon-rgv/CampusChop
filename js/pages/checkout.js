// CampusChop - Checkout Page Controller
import { renderNavbar } from '../components/navbar.js';
import { renderFooter } from '../components/footer.js';
import { authService } from '../services/auth.service.js';
import { ordersService } from '../services/orders.service.js';
import { zonesService } from '../services/zones.service.js';
import { paymentsService } from '../services/payments.service.js';
import { getCart, clearCart, getCartTotals } from '../utils/cart.js';
import { formatNaira, escapeHtml } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

let activeZones = [];
let currentProfile = null;
let pendingOrderPayload = null;

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();
  renderFooter();

  // 1. Ensure user is authenticated
  const authData = await authService.requireAuth([], '/login.html');
  if (!authData) return;
  currentProfile = authData.profile;

  // 2. Validate cart has items
  const cart = getCart();
  if (!cart.items || cart.items.length === 0) {
    toast.warning('Your shopping cart is empty.');
    window.location.href = '/marketplace.html';
    return;
  }

  // 3. Pre-fill customer details from profile
  const nameInput = document.getElementById('checkout-name');
  const phoneInput = document.getElementById('checkout-phone');
  const addressInput = document.getElementById('checkout-address');

  if (nameInput && currentProfile.full_name) {
    nameInput.value = currentProfile.full_name;
  }
  if (phoneInput && currentProfile.phone) {
    phoneInput.value = currentProfile.phone;
  }
  if (addressInput && currentProfile.delivery_address) {
    addressInput.value = currentProfile.delivery_address;
  }

  // 4. Load delivery zones
  try {
    activeZones = await zonesService.getActiveZones();
    populateZonesDropdown();
  } catch (e) {
    console.error('Error loading zones:', e);
  }

  // Render items preview
  renderItemsPreview();

  // Setup form interactions
  setupCheckoutInteractions();
});

const populateZonesDropdown = () => {
  const zoneSelect = document.getElementById('checkout-zone');
  if (!zoneSelect) return;

  const savedZoneId = sessionStorage.getItem('campuschop_zone_id');

  if (activeZones.length === 0) {
    zoneSelect.innerHTML = `<option value="">Standard Campus Area (₦300.00)</option>`;
  } else {
    zoneSelect.innerHTML = activeZones.map((z) => `
      <option value="${z.id}" ${z.id === savedZoneId ? 'selected' : ''}>
        ${escapeHtml(z.name)} — ${formatNaira(z.fee)} (~${z.estimated_delivery_minutes} mins)
      </option>
    `).join('');
  }

  updateCheckoutCalculations();
};

const renderItemsPreview = () => {
  const cart = getCart();
  const vendorNameEl = document.getElementById('checkout-vendor-name');
  const itemsContainer = document.getElementById('checkout-items-preview');

  if (vendorNameEl) {
    vendorNameEl.textContent = cart.vendor?.name || 'Local Food Vendor';
  }

  if (itemsContainer) {
    itemsContainer.innerHTML = cart.items.map((item) => `
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px solid var(--bg-alt); padding-bottom:0.35rem;">
        <div>
          <strong>${item.quantity}x</strong> ${escapeHtml(item.name)}
        </div>
        <div>${formatNaira(Number(item.price) * Number(item.quantity))}</div>
      </div>
    `).join('');
  }
};

const setupCheckoutInteractions = () => {
  const form = document.getElementById('checkout-form');
  const fulfilmentRadios = document.querySelectorAll('input[name="fulfilment_type"]');
  const deliveryFields = document.getElementById('checkout-delivery-fields');
  const zoneSelect = document.getElementById('checkout-zone');
  const addressInput = document.getElementById('checkout-address');

  // Fulfilment radio change
  fulfilmentRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const isDelivery = e.target.value === 'delivery';
      if (deliveryFields) deliveryFields.style.display = isDelivery ? 'block' : 'none';
      if (addressInput) addressInput.required = isDelivery;
      if (zoneSelect) zoneSelect.required = isDelivery;
      updateCheckoutCalculations();
    });
  });

  if (zoneSelect) {
    zoneSelect.addEventListener('change', updateCheckoutCalculations);
  }

  // Submit checkout
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  // Paystack fallback modal switches
  const paystackModal = document.getElementById('paystack-notice-modal');
  const closePaystackBtn = document.getElementById('close-paystack-notice');
  const cancelPaystackBtn = document.getElementById('cancel-paystack-notice');
  const switchCashBtn = document.getElementById('switch-cash-btn');

  const closePaystackNotice = () => {
    if (paystackModal) paystackModal.classList.remove('active');
  };

  if (closePaystackBtn) closePaystackBtn.addEventListener('click', closePaystackNotice);
  if (cancelPaystackBtn) cancelPaystackBtn.addEventListener('click', closePaystackNotice);

  if (switchCashBtn) {
    switchCashBtn.addEventListener('click', async () => {
      closePaystackNotice();
      if (pendingOrderPayload) {
        pendingOrderPayload.paymentMethod = 'cash_on_delivery';
        await executeCreateOrder(pendingOrderPayload);
      }
    });
  }
};

const updateCheckoutCalculations = () => {
  const fulfilmentType = document.querySelector('input[name="fulfilment_type"]:checked')?.value || 'delivery';
  const zoneSelect = document.getElementById('checkout-zone');
  const selectedZoneId = zoneSelect?.value;

  let deliveryFee = 0;
  if (fulfilmentType === 'delivery') {
    const zone = activeZones.find((z) => z.id === selectedZoneId);
    deliveryFee = zone ? Number(zone.fee) : (activeZones.length > 0 ? Number(activeZones[0].fee) : 300);
  }

  const totals = getCartTotals(deliveryFee);

  const subtotalEl = document.getElementById('checkout-subtotal');
  const feeLabelEl = document.getElementById('checkout-fee-label');
  const feeEl = document.getElementById('checkout-fee');
  const totalEl = document.getElementById('checkout-total');

  if (subtotalEl) subtotalEl.textContent = formatNaira(totals.subtotal);
  if (feeLabelEl) {
    feeLabelEl.textContent = fulfilmentType === 'delivery' ? 'Delivery Fee:' : 'Store Pickup:';
  }
  if (feeEl) {
    feeEl.textContent = fulfilmentType === 'delivery' ? formatNaira(deliveryFee) : 'FREE (₦0.00)';
  }
  if (totalEl) totalEl.textContent = formatNaira(totals.total);
};

const handleFormSubmit = async (e) => {
  e.preventDefault();

  const placeBtn = document.getElementById('place-order-btn');
  const cart = getCart();

  if (!cart.vendor || cart.items.length === 0) {
    toast.error('Your cart is empty.');
    return;
  }

  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const fulfilmentType = document.querySelector('input[name="fulfilment_type"]:checked').value;
  const paymentMethodInput = document.querySelector('input[name="payment_method"]:checked').value;
  const zoneId = fulfilmentType === 'delivery' ? document.getElementById('checkout-zone').value : null;
  const address = fulfilmentType === 'delivery' ? document.getElementById('checkout-address').value.trim() : '';
  const instructions = document.getElementById('checkout-instructions').value.trim();

  // Normalize payment method string
  let paymentMethod = paymentMethodInput;
  if (paymentMethodInput === 'cash') {
    paymentMethod = fulfilmentType === 'delivery' ? 'cash_on_delivery' : 'cash_on_pickup';
  }

  const payload = {
    vendorId: cart.vendor.id,
    items: cart.items,
    fulfilmentType,
    deliveryZoneId: zoneId,
    deliveryAddress: address,
    deliveryPhone: phone,
    deliveryInstructions: instructions,
    paymentMethod,
    customerName: name,
  };

  pendingOrderPayload = payload;

  if (paymentMethod === 'online') {
    // Attempt online Paystack initialization
    try {
      placeBtn.disabled = true;
      placeBtn.textContent = 'Contacting Payment Gateway...';

      // First create the order in database with status awaiting_payment
      const order = await ordersService.createOrder(payload);

      // Attempt Edge Function initialization
      const initResult = await paymentsService.initializePaystackTransaction({
        orderId: order.id,
        email: currentProfile.email,
        amount: order.total_amount,
      });

      if (initResult.success && initResult.authorizationUrl) {
        clearCart();
        window.location.href = initResult.authorizationUrl;
        return;
      }

      // If Edge function is not configured, present friendly notice modal
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order Now';
      const modal = document.getElementById('paystack-notice-modal');
      if (modal) modal.classList.add('active');

    } catch (err) {
      console.error('Order creation error:', err);
      toast.error(err.message || 'Could not place order.');
      placeBtn.disabled = false;
      placeBtn.textContent = 'Place Order Now';
    }
  } else {
    // Cash payment flow
    await executeCreateOrder(payload);
  }
};

const executeCreateOrder = async (payload) => {
  const placeBtn = document.getElementById('place-order-btn');
  try {
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing Order...';

    const order = await ordersService.createOrder(payload);
    clearCart();

    toast.success(`Order ${order.order_number} successfully placed!`);
    setTimeout(() => {
      window.location.href = `/orders.html?orderId=${order.id}`;
    }, 800);
  } catch (err) {
    console.error('Error placing order:', err);
    toast.error(err.message || 'Unable to place order. Please try again.');
    placeBtn.disabled = false;
    placeBtn.textContent = 'Place Order Now';
  }
};
