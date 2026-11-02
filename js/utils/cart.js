// CampusChop - Shopping Cart Utility
// Enforces Single-Vendor Rule per order

const CART_STORAGE_KEY = 'campuschop_cart';

export const getCart = () => {
  if (typeof window === 'undefined') return { vendor: null, items: [] };
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { vendor: null, items: [] };
    const parsed = JSON.parse(raw);
    return {
      vendor: parsed.vendor || null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (e) {
    console.error('Error reading cart from localStorage', e);
    return { vendor: null, items: [] };
  }
};

const saveCart = (cart) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  dispatchCartUpdated();
};

export const dispatchCartUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('campuschop:cart-updated', { detail: getCart() }));
  }
};

/**
 * Add a product to the cart.
 * If product is from a different vendor than existing cart items,
 * returns { conflict: true, existingVendor, newVendor } unless forceReplace is true.
 */
export const addToCart = (product, vendor, quantity = 1, forceReplace = false) => {
  const cart = getCart();

  // If cart already has items from another vendor
  if (cart.items.length > 0 && cart.vendor && cart.vendor.id !== vendor.id) {
    if (!forceReplace) {
      return {
        conflict: true,
        existingVendor: cart.vendor,
        newVendor: vendor,
        product,
        quantity,
      };
    }
    // Customer agreed to replace cart with new vendor's meals
    cart.items = [];
    cart.vendor = { id: vendor.id, name: vendor.business_name || vendor.name };
  }

  // If cart was empty, set current vendor
  if (cart.items.length === 0 || !cart.vendor) {
    cart.vendor = { id: vendor.id, name: vendor.business_name || vendor.name };
  }

  // Check if item already exists in cart
  const existingIdx = cart.items.findIndex((item) => item.product_id === product.id);

  if (existingIdx > -1) {
    cart.items[existingIdx].quantity += quantity;
    if (cart.items[existingIdx].quantity <= 0) {
      cart.items.splice(existingIdx, 1);
    }
  } else if (quantity > 0) {
    cart.items.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity,
      image_url: product.image_url,
      vendor_id: vendor.id,
    });
  }

  // If items became 0, reset vendor
  if (cart.items.length === 0) {
    cart.vendor = null;
  }

  saveCart(cart);
  return { success: true, cart };
};

export const updateQuantity = (productId, newQuantity) => {
  const cart = getCart();
  const index = cart.items.findIndex((item) => item.product_id === productId);

  if (index > -1) {
    if (newQuantity <= 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = newQuantity;
    }

    if (cart.items.length === 0) {
      cart.vendor = null;
    }
    saveCart(cart);
  }
  return cart;
};

export const removeFromCart = (productId) => {
  return updateQuantity(productId, 0);
};

export const clearCart = () => {
  const emptyCart = { vendor: null, items: [] };
  saveCart(emptyCart);
  return emptyCart;
};

export const getItemCount = () => {
  const cart = getCart();
  return cart.items.reduce((total, item) => total + (item.quantity || 0), 0);
};

export const getCartTotals = (deliveryFee = 0) => {
  const cart = getCart();
  const subtotal = cart.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const fee = Number(deliveryFee) || 0;
  const total = subtotal + fee;

  return {
    subtotal,
    deliveryFee: fee,
    total,
    itemCount: getItemCount(),
  };
};
