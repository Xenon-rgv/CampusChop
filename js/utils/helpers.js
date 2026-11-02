// CampusChop - General Helper Utilities

/**
 * Format a number as Nigerian Naira currency
 * e.g., 1500 => "₦1,500.00"
 */
export const formatNaira = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num).replace('NGN', '₦');
};

/**
 * Format date timestamp to readable string
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Returns HTML badge element for Order Status
 */
export const getOrderStatusBadge = (status) => {
  switch (status) {
    case 'pending':
      return `<span class="badge badge-warning">⏳ Pending</span>`;
    case 'awaiting_payment':
      return `<span class="badge badge-warning">💳 Awaiting Payment</span>`;
    case 'confirmed':
      return `<span class="badge badge-info">👍 Confirmed</span>`;
    case 'preparing':
      return `<span class="badge badge-primary">🍳 Preparing</span>`;
    case 'ready':
      return `<span class="badge badge-success">🍱 Ready</span>`;
    case 'out_for_delivery':
      return `<span class="badge badge-info">🛵 Out for Delivery</span>`;
    case 'completed':
      return `<span class="badge badge-success">✅ Completed</span>`;
    case 'rejected':
      return `<span class="badge badge-danger">❌ Rejected</span>`;
    case 'cancelled':
      return `<span class="badge badge-neutral">🚫 Cancelled</span>`;
    default:
      return `<span class="badge badge-neutral">${escapeHtml(status || 'unknown')}</span>`;
  }
};

/**
 * Returns HTML badge element for Payment Status
 */
export const getPaymentStatusBadge = (status) => {
  switch (status) {
    case 'paid':
      return `<span class="badge badge-success">Paid (Online)</span>`;
    case 'cash_received':
      return `<span class="badge badge-success">Cash Received</span>`;
    case 'pending':
      return `<span class="badge badge-warning">Payment Pending</span>`;
    case 'unpaid':
      return `<span class="badge badge-neutral">Unpaid</span>`;
    case 'failed':
      return `<span class="badge badge-danger">Payment Failed</span>`;
    case 'refunded':
      return `<span class="badge badge-info">Refunded</span>`;
    default:
      return `<span class="badge badge-neutral">${escapeHtml(status || 'unpaid')}</span>`;
  }
};

/**
 * Returns HTML badge element for Vendor Application Status
 */
export const getVendorStatusBadge = (status) => {
  switch (status) {
    case 'approved':
      return `<span class="badge badge-success">Active / Approved</span>`;
    case 'pending':
      return `<span class="badge badge-warning">Pending Review</span>`;
    case 'rejected':
      return `<span class="badge badge-danger">Application Rejected</span>`;
    case 'suspended':
      return `<span class="badge badge-danger">Suspended</span>`;
    default:
      return `<span class="badge badge-neutral">${escapeHtml(status || 'pending')}</span>`;
  }
};

/**
 * Simple HTML sanitizer to avoid XSS in dynamically injected text
 */
export const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
