import { useEffect, useState, useCallback } from 'react';
import { Search, Eye, X, Receipt, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Bill, BillItem } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface BillWithItemsData extends Bill {
  bill_items: BillItem[];
}

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all');
  const [viewingBill, setViewingBill] = useState<BillWithItemsData | null>(null);

  const loadBills = useCallback(async () => {
    let query = supabase.from('bills').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (search.trim()) {
      query = query.or(`bill_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }
    const { data } = await query;
    setBills(data || []);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const viewBill = async (bill: Bill) => {
    const { data: items } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .order('created_at', { ascending: true });
    setViewingBill({ ...bill, bill_items: items || [] });
  };

  const voidBill = async (id: string) => {
    if (!confirm('Void this bill? This marks it as voided but keeps the record.')) return;
    await supabase.from('bills').update({ status: 'voided' }).eq('id', id);
    loadBills();
    setViewingBill(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bills</h1>
        <p className="text-slate-500 text-sm mt-1">View and manage all billing transactions</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by bill number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'completed', 'voided'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No bills found</p>
            <p className="text-slate-400 text-sm mt-1">Create a bill from the New Bill section</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Bill No.</th>
                  <th className="text-left px-5 py-3 font-semibold">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 font-semibold">Payment</th>
                  <th className="text-right px-5 py-3 font-semibold">Total</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-slate-700">
                      {bill.bill_number || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{bill.customer_name}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDateTime(bill.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {bill.payment_method || 'Cash'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(bill.total)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          bill.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => viewBill(bill)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bill detail modal */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-slate-800">Bill Details</h2>
              <button onClick={() => setViewingBill(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Bill header */}
              <div className="text-center pb-4 border-b border-dashed border-slate-200">
                <h3 className="font-bold text-slate-800 text-lg">OptiStore</h3>
                <p className="text-xs text-slate-400">Optical & Hardware Management System</p>
                <p className="text-sm font-mono text-slate-600 mt-2">{viewingBill.bill_number}</p>
                <p className="text-xs text-slate-400">{formatDateTime(viewingBill.created_at)}</p>
              </div>

              {/* Customer info */}
              <div className="py-3 flex justify-between text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium text-slate-700">{viewingBill.customer_name}</span>
              </div>

              {/* Items */}
              <div className="py-3 border-t border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs">
                      <th className="text-left pb-2 font-medium">Item</th>
                      <th className="text-center pb-2 font-medium">Qty</th>
                      <th className="text-right pb-2 font-medium">Price</th>
                      <th className="text-right pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingBill.bill_items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-50">
                        <td className="py-2 text-slate-700">{item.product_name}</td>
                        <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                        <td className="py-2 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2 text-right font-medium text-slate-700">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700">{formatCurrency(viewingBill.subtotal)}</span>
                </div>
                {viewingBill.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-red-600">−{formatCurrency(viewingBill.discount)}</span>
                  </div>
                )}
                {viewingBill.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax ({viewingBill.tax_rate}%)</span>
                    <span className="text-slate-700">
                      {formatCurrency(((viewingBill.subtotal - viewingBill.discount) * viewingBill.tax_rate) / 100)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-bold text-lg text-sky-600">{formatCurrency(viewingBill.total)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-slate-500">Payment</span>
                  <span className="text-slate-700">{viewingBill.payment_method}</span>
                </div>
              </div>

              {/* Status badge */}
              <div className="pt-3 flex items-center justify-between">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    viewingBill.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {viewingBill.status}
                </span>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
              </div>

              {viewingBill.status === 'completed' && (
                <button
                  onClick={() => voidBill(viewingBill.id)}
                  className="w-full mt-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Void this bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
