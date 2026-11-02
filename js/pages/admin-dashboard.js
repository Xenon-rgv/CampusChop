// CampusChop - Administrator Dashboard Controller
import { renderNavbar } from '../components/navbar.js';
import { authService } from '../services/auth.service.js';
import { vendorsService } from '../services/vendors.service.js';
import { ordersService } from '../services/orders.service.js';
import { zonesService } from '../services/zones.service.js';
import { productsService } from '../services/products.service.js';
import { formatNaira, formatDate, getOrderStatusBadge, getPaymentStatusBadge, getVendorStatusBadge, escapeHtml } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

let allVendors = [];
let allOrders = [];
let allZones = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();

  // Guard page: Only users with 'admin' role in profiles table
  const authData = await authService.requireAuth(['admin'], '/login.html');
  if (!authData) return;

  setupAdminTabs();
  setupZoneModal();
  await loadAdminData();
});

const setupAdminTabs = () => {
  const links = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.dashboard-tab-content');

  links.forEach((link) => {
    link.addEventListener('click', () => {
      const targetTab = link.dataset.tab;
      links.forEach((l) => l.classList.remove('active'));
      sections.forEach((s) => s.classList.remove('active'));

      link.classList.add('active');
      const targetSection = document.getElementById(`tab-${targetTab}`);
      if (targetSection) targetSection.classList.add('active');
    });
  });
};

const loadAdminData = async () => {
  try {
    const [vendors, orders, zones, categories] = await Promise.all([
      vendorsService.getAllVendorsAdmin(),
      ordersService.getAllOrdersAdmin(),
      zonesService.getAllZonesAdmin(),
      productsService.getCategories(),
    ]);

    allVendors = vendors || [];
    allOrders = orders || [];
    allZones = zones || [];
    allCategories = categories || [];

    updateAdminMetrics();
    renderVendorsTable();
    renderOrdersTable();
    renderZonesTable();
    renderCategoriesTable();
  } catch (err) {
    console.error('Error loading admin data:', err);
    toast.error('Error loading admin records.');
  }
};

const updateAdminMetrics = () => {
  const gmvEl = document.getElementById('admin-stat-gmv');
  const ordersEl = document.getElementById('admin-stat-orders');
  const pendingVendorsEl = document.getElementById('admin-stat-pending-vendors');
  const pendingBadge = document.getElementById('admin-pending-vendors-badge');
  const activeVendorsEl = document.getElementById('admin-stat-active-vendors');

  const totalGMV = allOrders
    .filter((o) => o.order_status === 'completed' || o.payment_status === 'paid' || o.payment_status === 'cash_received')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const pendingCount = allVendors.filter((v) => v.status === 'pending').length;
  const approvedCount = allVendors.filter((v) => v.status === 'approved').length;

  if (gmvEl) gmvEl.textContent = formatNaira(totalGMV);
  if (ordersEl) ordersEl.textContent = allOrders.length;
  if (pendingVendorsEl) pendingVendorsEl.textContent = pendingCount;
  if (activeVendorsEl) activeVendorsEl.textContent = approvedCount;

  if (pendingBadge) {
    pendingBadge.textContent = pendingCount;
    pendingBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
  }
};

const renderVendorsTable = () => {
  const tbody = document.getElementById('admin-vendors-tbody');
  if (!tbody) return;

  if (allVendors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No vendor accounts registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = allVendors.map((vendor) => {
    return `
      <tr>
        <td>
          <div style="font-weight:700;">${escapeHtml(vendor.business_name)}</div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">Owner: ${escapeHtml(vendor.owner_name)} (${escapeHtml(vendor.phone)})</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(vendor.email)}</div>
        </td>
        <td>${escapeHtml(vendor.business_location || 'Abraka Axis')}</td>
        <td>${escapeHtml(vendor.primary_category || 'Dishes')}</td>
        <td>${getVendorStatusBadge(vendor.status)}</td>
        <td>${formatDate(vendor.created_at)}</td>
        <td>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${vendor.status === 'pending' ? `
              <button class="btn btn-sm btn-secondary approve-vendor-btn" data-id="${vendor.id}">
                ✓ Approve
              </button>
              <button class="btn btn-sm btn-danger reject-vendor-btn" data-id="${vendor.id}">
                ✕ Reject
              </button>
            ` : (vendor.status === 'approved' ? `
              <button class="btn btn-sm btn-outline text-danger suspend-vendor-btn" data-id="${vendor.id}">
                Suspend
              </button>
            ` : `
              <button class="btn btn-sm btn-outline approve-vendor-btn" data-id="${vendor.id}">
                Re-Approve
              </button>
            `)}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Vendor Action Events
  tbody.querySelectorAll('.approve-vendor-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        await vendorsService.updateVendorStatus(btn.dataset.id, 'approved');
        toast.success('Vendor approved! They can now publish meals and receive orders.');
        await loadAdminData();
      } catch (e) {
        toast.error(e.message || 'Error approving vendor.');
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('.reject-vendor-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reason = prompt('Reason for rejection:');
      if (reason === null) return;
      try {
        btn.disabled = true;
        await vendorsService.updateVendorStatus(btn.dataset.id, 'rejected', reason || 'Requirements not met');
        toast.warning('Vendor application rejected.');
        await loadAdminData();
      } catch (e) {
        toast.error(e.message || 'Error rejecting vendor.');
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll('.suspend-vendor-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Suspend this vendor from receiving customer orders?')) {
        try {
          btn.disabled = true;
          await vendorsService.updateVendorStatus(btn.dataset.id, 'suspended');
          toast.warning('Vendor suspended.');
          await loadAdminData();
        } catch (e) {
          toast.error(e.message || 'Error suspending vendor.');
          btn.disabled = false;
        }
      }
    });
  });
};

const renderOrdersTable = () => {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  if (allOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No customer orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allOrders.map((order) => {
    return `
      <tr>
        <td>
          <strong>#${escapeHtml(order.order_number)}</strong><br>
          <small style="color:var(--text-muted);">${formatDate(order.created_at)}</small>
        </td>
        <td>${escapeHtml(order.vendor?.business_name || 'Vendor')}</td>
        <td>
          ${escapeHtml(order.customer?.full_name || 'Customer')}<br>
          <small style="color:var(--text-muted);">${escapeHtml(order.delivery_phone || '')}</small>
        </td>
        <td>
          ${order.fulfilment_type === 'delivery' ? `🛵 ${escapeHtml(order.delivery_zone?.name || 'Abraka')}` : '🛍️ Counter Pickup'}
        </td>
        <td><strong>${formatNaira(order.total_amount)}</strong></td>
        <td>${getOrderStatusBadge(order.order_status)}</td>
        <td>${getPaymentStatusBadge(order.payment_status)}</td>
      </tr>
    `;
  }).join('');
};

const renderZonesTable = () => {
  const tbody = document.getElementById('admin-zones-tbody');
  if (!tbody) return;

  if (allZones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">No delivery zones configured yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allZones.map((z) => {
    return `
      <tr>
        <td><strong>${escapeHtml(z.name)}</strong></td>
        <td><small style="color:var(--text-secondary);">${escapeHtml(z.description || '')}</small></td>
        <td><strong>${formatNaira(z.fee)}</strong></td>
        <td>~${z.estimated_delivery_minutes} mins</td>
        <td>
          <span class="badge ${z.is_active ? 'badge-success' : 'badge-neutral'}">
            ${z.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline edit-zone-btn" data-id="${z.id}">
            Edit Fee
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.edit-zone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const zone = allZones.find((z) => z.id === btn.dataset.id);
      if (zone) openZoneModal(zone);
    });
  });
};

const renderCategoriesTable = () => {
  const tbody = document.getElementById('admin-categories-tbody');
  if (!tbody) return;

  if (allCategories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">No categories found.</td></tr>`;
    return;
  }

  tbody.innerHTML = allCategories.map((c) => `
    <tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td><code>${escapeHtml(c.slug)}</code></td>
      <td><small style="color:var(--text-secondary);">${escapeHtml(c.description || '')}</small></td>
      <td>#${c.display_order}</td>
    </tr>
  `).join('');
};

const setupZoneModal = () => {
  const modal = document.getElementById('zone-modal');
  const openBtn = document.getElementById('open-add-zone-modal-btn');
  const closeBtn = document.getElementById('close-zone-modal');
  const cancelBtn = document.getElementById('cancel-zone-modal');
  const form = document.getElementById('zone-form');

  if (openBtn) openBtn.addEventListener('click', () => openZoneModal());

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('zone-edit-id').value;
      const name = document.getElementById('zone-name').value.trim();
      const fee = document.getElementById('zone-fee').value;
      const time = document.getElementById('zone-time').value;
      const desc = document.getElementById('zone-desc').value.trim();
      const isActive = document.getElementById('zone-is-active').checked;
      const saveBtn = document.getElementById('save-zone-btn');

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        if (id) {
          await zonesService.updateZone(id, {
            name,
            fee: Number(fee),
            estimated_delivery_minutes: Number(time),
            description: desc,
            is_active: isActive,
          });
          toast.success('Delivery zone updated!');
        } else {
          await zonesService.createZone({
            name,
            fee,
            estimatedDeliveryMinutes: time,
            description: desc,
          });
          toast.success('New delivery zone created!');
        }

        closeModal();
        await loadAdminData();
      } catch (err) {
        console.error('Zone save error:', err);
        toast.error(err.message || 'Error saving delivery zone.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Delivery Zone';
      }
    });
  }
};

const openZoneModal = (zone = null) => {
  const modal = document.getElementById('zone-modal');
  const title = document.getElementById('zone-modal-title');
  const idInput = document.getElementById('zone-edit-id');
  const nameInput = document.getElementById('zone-name');
  const feeInput = document.getElementById('zone-fee');
  const timeInput = document.getElementById('zone-time');
  const descInput = document.getElementById('zone-desc');
  const activeInput = document.getElementById('zone-is-active');

  if (zone) {
    if (title) title.textContent = 'Edit Delivery Zone & Fee';
    if (idInput) idInput.value = zone.id;
    if (nameInput) nameInput.value = zone.name;
    if (feeInput) feeInput.value = zone.fee;
    if (timeInput) timeInput.value = zone.estimated_delivery_minutes;
    if (descInput) descInput.value = zone.description || '';
    if (activeInput) activeInput.checked = zone.is_active;
  } else {
    if (title) title.textContent = 'Add Delivery Zone';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (feeInput) feeInput.value = 350;
    if (timeInput) timeInput.value = 30;
    if (descInput) descInput.value = '';
    if (activeInput) activeInput.checked = true;
  }

  if (modal) modal.classList.add('active');
};
