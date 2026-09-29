import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, X, ShoppingCart, User, CreditCard, Check, Receipt, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Customer, View } from '@/types';
import { formatCurrency } from '@/lib/format';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  stock: number;
}

interface BillingProps {
  onNavigate: (view: View) => void;
}

export default function Billing({ onNavigate }: BillingProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const loadProducts = useCallback(async () => {
    let query = supabase.from('products').select('*').order('name', { ascending: true });
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    const { data } = await query;
    setProducts(data || []);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    supabase.from('customers').select('*').order('name', { ascending: true }).then(({ data }) => {
      setCustomers(data || []);
    });
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find((c) => c.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCart(
        cart.map((c) =>
          c.product_id === product.id
            ? {
              ...c,
              quantity: c.quantity + 1,
              line_total: (c.quantity + 1) * c.unit_price,
            }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          line_total: product.price,
          stock: product.stock,
        },
      ]);
    }
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty < 1) return;
    setCart(
      cart.map((c) =>
        c.product_id === productId
          ? { ...c, quantity: qty, line_total: qty * c.unit_price }
          : c
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product_id !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + c.line_total, 0);
  const discountAmount = parseFloat(discount) || 0;
  const taxAmount = ((subtotal - discountAmount) * (parseFloat(taxRate) || 0)) / 100;
  const total = subtotal - discountAmount + taxAmount;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone || '').includes(customerSearch)
  );

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('Add at least one product to the bill');
      return;
    }
    setSaving(true);
    setError('');

    // Generate bill number
    const { data: billNumber } = await supabase.rpc('generate_bill_number');

    const billPayload = {
      bill_number: billNumber,
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || 'Walk-in Customer',
      subtotal,
      discount: discountAmount,
      tax_rate: parseFloat(taxRate) || 0,
      total,
      payment_method: paymentMethod,
      status: 'completed',
      notes: notes || null,
    };

    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert(billPayload)
      .select()
      .single();

    if (billError) {
      setError(billError.message);
      setSaving(false);
      return;
    }

    // Insert bill items
    const billItems = cart.map((c) => ({
      bill_id: billData.id,
      product_id: c.product_id,
      product_name: c.product_name,
      quantity: c.quantity,
      unit_price: c.unit_price,
      line_total: c.line_total,
    }));

    const { error: itemsError } = await supabase.from('bill_items').insert(billItems);

    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    // Decrement stock
    for (const item of cart) {
      await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      }).then(() => {});
    }

    setSuccess(true);
    setSaving(false);
  };

  const resetForm = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscount('0');
    setTaxRate('0');
    setPaymentMethod('Cash');
    setNotes('');
    setSuccess(false);
    setError('');
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <Check className="w-10 h-10 text-emerald-600" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Bill Created Successfully</h2>
        <p className="text-slate-500 text-sm mt-2 text-center">
          The bill has been saved and inventory has been updated.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={resetForm}
            className="px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors"
          >
            New Bill
          </button>
          <button
            onClick={() => onNavigate('bills')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            View Bills
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Create New Bill</h1>
        <p className="text-slate-500 text-sm mt-1">Select products and generate a bill for the customer</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Product picker */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pb-2">
            {products.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-slate-400 text-sm">
                No products found. Add products in the Inventory section first.
              </div>
            ) : (
              products.map((p) => {
                const inCart = cart.find((c) => c.product_id === p.id);
                const outOfStock = p.stock <= 0 || (inCart && inCart.quantity >= p.stock);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={outOfStock}
                    className={`text-left bg-white rounded-xl border overflow-hidden transition-all ${
                      outOfStock
                        ? 'border-slate-100 opacity-50 cursor-not-allowed'
                        : 'border-slate-100 shadow-sm hover:shadow-md hover:border-sky-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 text-sm truncate">{p.name}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {p.category} {p.subcategory ? `· ${p.subcategory}` : ''}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                              p.stock <= p.low_stock_threshold
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {p.stock} in stock
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold text-slate-800">{formatCurrency(p.price)}</span>
                          {inCart && (
                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                              {inCart.quantity} in cart
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Cart / Bill summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm sticky top-4">
            {/* Customer selector */}
            <div className="px-5 py-4 border-b border-slate-100">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Customer
              </label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-sky-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-slate-400 truncate">{selectedCustomer.phone}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomerPicker(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm hover:border-sky-400 hover:text-sky-500 transition-colors"
                >
                  <User className="w-4 h-4" /> Select customer (optional)
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="px-5 py-4 border-b border-slate-100 max-h-64 overflow-y-auto">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Items ({cart.length})
              </label>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{item.product_name}</p>
                        <p className="text-xs text-slate-400">
                          {formatCurrency(item.unit_price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.product_id, item.quantity - 1)}
                          className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.product_id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 text-xs font-bold flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-medium text-slate-800 w-16 text-right">
                        {formatCurrency(item.line_total)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-500">Discount (₹)</span>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-right text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>

              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-slate-500">Tax (%)</span>
                <input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-right text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="font-bold text-slate-800">Total</span>
                <span className="font-bold text-lg text-sky-600">{formatCurrency(total)}</span>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  <CreditCard className="w-3 h-3 inline mr-1" /> Payment Method
                </label>
                <div className="flex gap-2">
                  {['Cash', 'Card', 'UPI'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        paymentMethod === m
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={saving || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Receipt className="w-4 h-4" />
                {saving ? 'Creating Bill...' : 'Complete Bill'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer picker modal */}
      {showCustomerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Select Customer</h2>
              <button onClick={() => setShowCustomerPicker(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No customers found</div>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setShowCustomerPicker(false);
                      setCustomerSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setShowCustomerPicker(false);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Continue as Walk-in Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
