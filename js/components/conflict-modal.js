// CampusChop - Vendor Cart Conflict Dialog

export const showVendorConflictModal = ({ existingVendor, newVendor, onConfirm, onCancel }) => {
  let modal = document.getElementById('vendor-conflict-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vendor-conflict-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const existingName = existingVendor?.name || 'another vendor';
  const newName = newVendor?.business_name || newVendor?.name || 'this vendor';

  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">Replace Items in Cart?</h3>
        <button class="modal-close" id="conflict-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size:2.2rem; text-align:center; margin-bottom:1rem;">🛒 ⚠️</div>
        <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:1rem; line-height:1.5;">
          Your shopping cart currently contains delicious meals from <strong>${escapeHtml(existingName)}</strong>.
        </p>
        <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5;">
          To ensure timely preparation and fast campus delivery in Abraka, each order must be from a single vendor. Would you like to clear your existing cart and start a new order from <strong>${escapeHtml(newName)}</strong>?
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="conflict-cancel-btn">Keep Current Cart</button>
        <button class="btn btn-primary" id="conflict-confirm-btn">Replace Cart &amp; Add Meal</button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  const close = () => {
    modal.classList.remove('active');
  };

  const closeBtn = document.getElementById('conflict-close-btn');
  const cancelBtn = document.getElementById('conflict-cancel-btn');
  const confirmBtn = document.getElementById('conflict-confirm-btn');

  if (closeBtn) {
    closeBtn.onclick = () => {
      close();
      if (onCancel) onCancel();
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      close();
      if (onCancel) onCancel();
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      close();
      if (onConfirm) onConfirm();
    };
  }
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
};
