// CampusChop - Vendor Dashboard Controller
import { renderNavbar } from '../components/navbar.js';
import { authService } from '../services/auth.service.js';
import { vendorsService } from '../services/vendors.service.js';
import { productsService } from '../services/products.service.js';
import { ordersService } from '../services/orders.service.js';
import { storageService } from '../services/storage.service.js';
import { formatNaira, formatDate, getOrderStatusBadge, getPaymentStatusBadge, escapeHtml } from '../utils/helpers.js';
import { toast } from '../utils/toast.js';

let vendorProfile = null;
let vendorOrders = [];
let vendorProducts = [];
let categories = [];
let activeOrderFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await renderNavbar();

  // Require Vendor or Admin role
  const authData = await authService.requireAuth(['vendor', 'admin'], '/login.html');
  if (!authData) return;

  // Load Vendor Profile
  await loadVendorData();

  // Setup tabs and actions
  setupDashboardTabs();
  setupProductModal();
  setupSettingsForm();
});

const loadVendorData = async () => {
  try {
    vendorProfile = await vendorsService.getMyVendorProfile();

    if (!vendorProfile) {
      document.querySelector('.dashboard-main').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏪</div>
          <h2>No Vendor Profile Found</h2>
          <p>You have not registered a vendor profile yet.</p>
          <a href="/register.html?role=vendor" class="btn btn-primary">Apply as a Vendor</a>
        </div>
      `;
      return;
    }

    // Update Header Pill
    const storeNameEl = document.getElementById('vendor-store-name');
    const statusPillEl = document.getElementById('vendor-status-pill');
    const pendingBanner = document.getElementById('pending-approval-banner');

    if (storeNameEl) storeNameEl.textContent = vendorProfile.business_name;
    if (statusPillEl) {
      statusPillEl.innerHTML = `
        <span class="badge ${vendorProfile.status === 'approved' ? 'badge-success' : 'badge-warning'}">
          ${vendorProfile.status.toUpperCase()}
        </span>
      `;
    }

    if (vendorProfile.status !== 'approved' && pendingBanner) {
      pendingBanner.style.display = 'block';
    }

    // Load categories
    categories = await productsService.getCategories();
    populateCategoryDropdown();

    // Load Vendor Orders & Products
    await Promise.all([loadOrders(), loadProducts()]);

    // Real-time subscription to incoming orders
    if (vendorProfile.status === 'approved') {
      ordersService.subscribeToVendorOrders(
        vendorProfile.id,
        (newOrder) => {
          toast.info(`🔔 New incoming order #${newOrder.order_number}!`);
          loadOrders();
        },
        (updatedOrder) => {
          loadOrders();
        }
      );
    }
  } catch (err) {
    console.error('Error loading vendor dashboard:', err);
    toast.error('Error loading vendor dashboard.');
  }
};

const setupDashboardTabs = () => {
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

  const gotoOrdersBtn = document.getElementById('goto-orders-tab-btn');
  if (gotoOrdersBtn) {
    gotoOrdersBtn.addEventListener('click', () => {
      const orderLink = document.querySelector('.sidebar-link[data-tab="orders"]');
      if (orderLink) orderLink.click();
    });
  }

  const quickAddBtn = document.getElementById('quick-add-food-btn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => {
      openProductModal();
    });
  }

  // Order filter buttons
  document.querySelectorAll('.order-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-btn').forEach((b) => b.className = 'btn btn-sm btn-outline order-filter-btn');
      btn.className = 'btn btn-sm btn-primary order-filter-btn active';
      activeOrderFilter = btn.dataset.filter;
      renderLiveOrdersTable();
    });
  });
};

const loadOrders = async () => {
  if (!vendorProfile) return;
  try {
    vendorOrders = await ordersService.getVendorOrders(vendorProfile.id);
    updateMetrics();
    renderOverviewOrdersTable();
    renderLiveOrdersTable();
  } catch (e) {
    console.error('Error loading vendor orders', e);
  }
};

const loadProducts = async () => {
  if (!vendorProfile) return;
  try {
    vendorProducts = await productsService.getVendorProducts(vendorProfile.id);
    updateMetrics();
    renderProductsTable();
  } catch (e) {
    console.error('Error loading vendor products', e);
  }
};

const updateMetrics = () => {
  const salesEl = document.getElementById('stat-sales');
  const totalOrdersEl = document.getElementById('stat-total-orders');
  const pendingOrdersEl = document.getElementById('stat-pending-orders');
  const badgeEl = document.getElementById('pending-orders-badge');
  const productsEl = document.getElementById('stat-products');

  // Completed or paid sales
  const totalSales = vendorOrders
    .filter((o) => o.order_status === 'completed' || o.payment_status === 'paid' || o.payment_status === 'cash_received')
    .reduce((sum, o) => sum + Number(o.subtotal || o.total_amount), 0);

  const pendingCount = vendorOrders.filter((o) => o.order_status === 'pending').length;
  const activeProducts = vendorProducts.filter((p) => p.is_available).length;

  if (salesEl) salesEl.textContent = formatNaira(totalSales);
  if (totalOrdersEl) totalOrdersEl.textContent = vendorOrders.length;
  if (pendingOrdersEl) pendingOrdersEl.textContent = pendingCount;
  if (productsEl) productsEl.textContent = `${activeProducts} / ${vendorProducts.length}`;

  if (badgeEl) {
    badgeEl.textContent = pendingCount;
    badgeEl.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
  }
};

const renderOverviewOrdersTable = () => {
  const tbody = document.getElementById('overview-orders-tbody');
  if (!tbody) return;

  const recent = vendorOrders.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">No orders received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map((order) => {
    const customer = order.customer?.full_name || 'DELSU Student';
    const itemsCount = (order.order_items || []).reduce((sum, i) => sum + i.quantity, 0);

    return `
      <tr>
        <td><strong>#${escapeHtml(order.order_number)}</strong><br><small style="color:var(--text-muted);">${formatDate(order.created_at)}</small></td>
        <td>${escapeHtml(customer)}<br><small style="color:var(--text-muted);">${escapeHtml(order.delivery_phone || '')}</small></td>
        <td>${itemsCount} meal(s)</td>
        <td><strong>${formatNaira(order.total_amount)}</strong></td>
        <td>${getOrderStatusBadge(order.order_status)}</td>
        <td>${getPaymentStatusBadge(order.payment_status)}</td>
        <td>
          <button class="btn btn-sm btn-outline quick-view-order-btn" data-id="${order.id}">
            Manage &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.quick-view-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderLink = document.querySelector('.sidebar-link[data-tab="orders"]');
      if (orderLink) orderLink.click();
    });
  });
};

const renderLiveOrdersTable = () => {
  const tbody = document.getElementById('live-orders-tbody');
  if (!tbody) return;

  let filtered = [...vendorOrders];
  if (activeOrderFilter !== 'all') {
    filtered = filtered.filter((o) => o.order_status === activeOrderFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem;">No orders match this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((order) => {
    const isDelivery = order.fulfilment_type === 'delivery';
    const items = order.order_items || [];

    return `
      <tr>
        <td>
          <div style="font-weight:700;">#${escapeHtml(order.order_number)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${formatDate(order.created_at)}</div>
          <div style="margin-top:0.35rem;">
            ${getOrderStatusBadge(order.order_status)}
            ${getPaymentStatusBadge(order.payment_status)}
          </div>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(order.customer?.full_name || 'Customer')}</div>
          <a href="tel:${escapeHtml(order.delivery_phone)}" style="font-size:0.85rem; color:var(--primary); font-weight:600;">
            📞 ${escapeHtml(order.delivery_phone)}
          </a>
        </td>
        <td>
          <div style="font-weight:600;">${isDelivery ? '🛵 Delivery' : '🛍️ Counter Pickup'}</div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">
            ${isDelivery ? `${escapeHtml(order.delivery_zone?.name || 'Abraka')}<br><small>${escapeHtml(order.delivery_address || '')}</small>` : 'Pickup at store'}
          </div>
          ${order.delivery_instructions ? `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">"${escapeHtml(order.delivery_instructions)}"</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.85rem;">
            ${items.map((i) => `<div>• <strong>${i.quantity}x</strong> ${escapeHtml(i.product_name_snapshot)}</div>`).join('')}
          </div>
        </td>
        <td>
          <strong>${formatNaira(order.total_amount)}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted);">${order.payment_method.replace(/_/g, ' ')}</div>
        </td>
        <td>
          <div class="order-actions-bar">
            ${renderOrderActionButtons(order)}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachOrderActionEvents();
};

const renderOrderActionButtons = (order) => {
  const isDelivery = order.fulfilment_type === 'delivery';
  let btns = '';

  if (order.order_status === 'pending') {
    btns += `
      <button class="btn btn-sm btn-primary action-status-btn" data-id="${order.id}" data-action="confirmed">
        ✓ Accept Order
      </button>
      <button class="btn btn-sm btn-danger action-reject-btn" data-id="${order.id}">
        ✕ Reject
      </button>
    `;
  } else if (order.order_status === 'confirmed') {
    btns += `
      <button class="btn btn-sm btn-primary action-status-btn" data-id="${order.id}" data-action="preparing">
        🍳 Start Preparing
      </button>
    `;
  } else if (order.order_status === 'preparing') {
    btns += `
      <button class="btn btn-sm btn-secondary action-status-btn" data-id="${order.id}" data-action="ready">
        🍱 Mark as Ready
      </button>
    `;
  } else if (order.order_status === 'ready') {
    if (isDelivery) {
      btns += `
        <button class="btn btn-sm btn-primary action-status-btn" data-id="${order.id}" data-action="out_for_delivery">
          🛵 Dispatch Delivery
        </button>
      `;
    } else {
      btns += `
        <button class="btn btn-sm btn-secondary action-status-btn" data-id="${order.id}" data-action="completed">
          ✅ Customer Collected
        </button>
      `;
    }
  } else if (order.order_status === 'out_for_delivery') {
    btns += `
      <button class="btn btn-sm btn-secondary action-status-btn" data-id="${order.id}" data-action="completed">
        ✅ Mark Delivered
      </button>
    `;
  }

  // Cash confirmation button if unpaid cash order
  if (order.payment_status === 'unpaid' && (order.payment_method === 'cash_on_delivery' || order.payment_method === 'cash_on_pickup')) {
    btns += `
      <button class="btn btn-sm btn-outline action-cash-received-btn" data-id="${order.id}" style="border-color:var(--secondary); color:var(--secondary);">
        💵 Confirm Cash Received
      </button>
    `;
  }

  return btns || `<span style="font-size:0.85rem; color:var(--text-muted);">No actions available</span>`;
};

const attachOrderActionEvents = () => {
  document.querySelectorAll('.action-status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const nextStatus = btn.dataset.action;
      try {
        btn.disabled = true;
        await ordersService.updateOrderStatus(orderId, nextStatus);
        toast.success(`Order updated to ${nextStatus.replace(/_/g, ' ')}!`);
        await loadOrders();
      } catch (e) {
        toast.error(e.message || 'Error updating order status.');
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.action-reject-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const reason = prompt('Please state the reason for rejecting this order (e.g. out of ingredient, store closing):');
      if (reason === null) return;
      try {
        btn.disabled = true;
        await ordersService.updateOrderStatus(orderId, 'rejected', reason || 'Store unable to fulfil order');
        toast.warning('Order rejected.');
        await loadOrders();
      } catch (e) {
        toast.error(e.message || 'Error rejecting order.');
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.action-cash-received-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      if (confirm('Confirm you have received the exact cash payment for this order?')) {
        try {
          btn.disabled = true;
          await ordersService.markCashReceived(orderId);
          toast.success('Payment status updated to Cash Received!');
          await loadOrders();
        } catch (e) {
          toast.error(e.message || 'Error recording cash receipt.');
          btn.disabled = false;
        }
      }
    });
  });
};

const renderProductsTable = () => {
  const tbody = document.getElementById('vendor-products-tbody');
  if (!tbody) return;

  if (vendorProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">
          You haven't added any meals yet. Click <strong>+ Add Food Item</strong> to start building your menu!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = vendorProducts.map((p) => {
    const img = p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${escapeHtml(img)}" alt="" style="width:45px; height:45px; border-radius:var(--radius-sm); object-fit:cover;">
            <div>
              <div style="font-weight:700;">${escapeHtml(p.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(p.description || '')}
              </div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(p.category?.name || 'Local Meal')}</td>
        <td><strong>${formatNaira(p.price)}</strong></td>
        <td>${p.preparation_time_minutes || 20} mins</td>
        <td>
          <label style="display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
            <input type="checkbox" class="toggle-availability-input" data-id="${p.id}" ${p.is_available ? 'checked' : ''}>
            <span class="badge ${p.is_available ? 'badge-success' : 'badge-danger'}">
              ${p.is_available ? 'In Stock' : 'Sold Out'}
            </span>
          </label>
        </td>
        <td>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-sm btn-outline edit-product-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-outline text-danger delete-product-btn" data-id="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Product Actions
  tbody.querySelectorAll('.toggle-availability-input').forEach((input) => {
    input.addEventListener('change', async () => {
      try {
        await productsService.toggleProductAvailability(input.dataset.id, input.checked);
        toast.info(input.checked ? 'Item marked In Stock' : 'Item marked Sold Out');
        await loadProducts();
      } catch (e) {
        toast.error('Error updating availability.');
      }
    });
  });

  tbody.querySelectorAll('.edit-product-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = vendorProducts.find((p) => p.id === btn.dataset.id);
      if (prod) openProductModal(prod);
    });
  });

  tbody.querySelectorAll('.delete-product-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this food item?')) {
        try {
          await productsService.deleteProduct(btn.dataset.id);
          toast.success('Food item deleted.');
          await loadProducts();
        } catch (e) {
          toast.error(e.message || 'Error deleting product.');
        }
      }
    });
  });
};

const populateCategoryDropdown = () => {
  const select = document.getElementById('prod-category');
  if (!select) return;
  select.innerHTML = `
    <option value="">Select Category</option>
    ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
  `;
};

const setupProductModal = () => {
  const modal = document.getElementById('product-modal');
  const openBtn = document.getElementById('open-add-product-modal-btn');
  const closeBtn = document.getElementById('close-product-modal');
  const cancelBtn = document.getElementById('cancel-product-modal');
  const form = document.getElementById('product-form');
  const dropzone = document.getElementById('image-upload-dropzone');
  const fileInput = document.getElementById('prod-image-file');
  const previewImg = document.getElementById('prod-image-preview');
  const urlInput = document.getElementById('prod-image-url');

  if (openBtn) openBtn.addEventListener('click', () => openProductModal());

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Local preview immediately
      const reader = new FileReader();
      reader.onload = (re) => {
        if (previewImg) previewImg.src = re.target.result;
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      try {
        toast.info('Uploading photograph to Supabase Storage...');
        const uploadedUrl = await storageService.uploadFoodImage(file, vendorProfile.id);
        if (urlInput) urlInput.value = uploadedUrl;
        toast.success('Food photograph uploaded!');
      } catch (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        toast.error(uploadErr.message || 'Could not upload image. You can paste an image URL instead.');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('prod-edit-id').value;
      const name = document.getElementById('prod-name').value.trim();
      const price = document.getElementById('prod-price').value;
      const categoryId = document.getElementById('prod-category').value;
      const desc = document.getElementById('prod-desc').value.trim();
      const imageUrl = document.getElementById('prod-image-url').value.trim();
      const prepTime = document.getElementById('prod-prep').value;
      const isAvailable = document.getElementById('prod-is-available').checked;
      const saveBtn = document.getElementById('save-product-btn');

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        if (editId) {
          // Update
          await productsService.updateProduct(editId, {
            name,
            price: Number(price),
            category_id: categoryId || null,
            description: desc,
            image_url: imageUrl || null,
            preparation_time_minutes: Number(prepTime) || 20,
            is_available: isAvailable,
          });
          toast.success('Food item updated!');
        } else {
          // Create
          await productsService.createProduct({
            vendorId: vendorProfile.id,
            name,
            price,
            categoryId,
            description: desc,
            imageUrl,
            preparationTimeMinutes: prepTime,
          });
          toast.success('New food item added to menu!');
        }

        closeModal();
        await loadProducts();
      } catch (err) {
        console.error('Save product error:', err);
        toast.error(err.message || 'Failed to save product.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Meal';
      }
    });
  }
};

const openProductModal = (product = null) => {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const editId = document.getElementById('prod-edit-id');
  const name = document.getElementById('prod-name');
  const price = document.getElementById('prod-price');
  const category = document.getElementById('prod-category');
  const desc = document.getElementById('prod-desc');
  const url = document.getElementById('prod-image-url');
  const preview = document.getElementById('prod-image-preview');
  const prep = document.getElementById('prod-prep');
  const available = document.getElementById('prod-is-available');

  if (product) {
    if (title) title.textContent = 'Edit Food Item';
    if (editId) editId.value = product.id;
    if (name) name.value = product.name;
    if (price) price.value = product.price;
    if (category) category.value = product.category_id || '';
    if (desc) desc.value = product.description || '';
    if (url) url.value = product.image_url || '';
    if (preview) preview.src = product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
    if (prep) prep.value = product.preparation_time_minutes || 20;
    if (available) available.checked = product.is_available;
  } else {
    if (title) title.textContent = 'Add Food Item';
    if (editId) editId.value = '';
    if (name) name.value = '';
    if (price) price.value = '';
    if (category) category.value = '';
    if (desc) desc.value = '';
    if (url) url.value = '';
    if (preview) preview.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
    if (prep) prep.value = 20;
    if (available) available.checked = true;
  }

  if (modal) modal.classList.add('active');
};

const setupSettingsForm = () => {
  const form = document.getElementById('vendor-settings-form');
  if (!form || !vendorProfile) return;

  const storeName = document.getElementById('setting-store-name');
  const phone = document.getElementById('setting-phone');
  const prepTime = document.getElementById('setting-preptime');
  const location = document.getElementById('setting-location');
  const desc = document.getElementById('setting-desc');
  const isOpen = document.getElementById('setting-is-open');

  if (storeName) storeName.value = vendorProfile.business_name || '';
  if (phone) phone.value = vendorProfile.phone || '';
  if (prepTime) prepTime.value = vendorProfile.prep_time_minutes || 25;
  if (location) location.value = vendorProfile.business_location || '';
  if (desc) desc.value = vendorProfile.description || '';
  if (isOpen) isOpen.checked = vendorProfile.is_open;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-settings-btn');
    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';

      await vendorsService.updateVendorSettings(vendorProfile.id, {
        business_name: storeName.value.trim(),
        phone: phone.value.trim(),
        prep_time_minutes: Number(prepTime.value),
        business_location: location.value.trim(),
        description: desc.value.trim(),
        is_open: isOpen.checked,
      });

      toast.success('Store settings saved successfully!');
      await loadVendorData();
    } catch (err) {
      console.error('Settings save error:', err);
      toast.error(err.message || 'Error saving settings.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Store Changes';
    }
  });
};
