import { useEffect, useState } from 'react';
import { Package, Users, Receipt, AlertTriangle, TrendingUp, Eye, Plus, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { View } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface DashboardData {
  totalProducts: number;
  totalCustomers: number;
  totalBills: number;
  totalRevenue: number;
  lowStockCount: number;
  recentBills: {
    id: string;
    bill_number: string;
    customer_name: string;
    total: number;
    status: string;
    created_at: string;
  }[];
  lowStockProducts: {
    id: string;
    name: string;
    stock: number;
    low_stock_threshold: number;
  }[];
  categoryBreakdown: { category: string; count: number; value: number }[];
}

interface DashboardProps {
  onNavigate: (view: View) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [products, customers, bills, lowStock, recentBills, opticalProducts, hardwareProducts] =
        await Promise.all([
          supabase.from('products').select('id, price, stock, category'),
          supabase.from('customers').select('id', { count: 'exact', head: true }),
          supabase.from('bills').select('id, total', { count: 'exact', head: true }),
          supabase
            .from('products')
            .select('id, name, stock, low_stock_threshold')
            .lt('stock', 5)
            .order('stock', { ascending: true })
            .limit(5),
          supabase
            .from('bills')
            .select('id, bill_number, customer_name, total, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('products')
            .select('id, price, stock')
            .eq('category', 'Optical'),
          supabase
            .from('products')
            .select('id, price, stock')
            .eq('category', 'Hardware'),
        ]);

      const totalRevenue =
        bills.data?.reduce((sum, b) => sum + (b.total || 0), 0) || 0;

      const opticalCount = opticalProducts.data?.length || 0;
      const opticalValue =
        opticalProducts.data?.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0) || 0;
      const hardwareCount = hardwareProducts.data?.length || 0;
      const hardwareValue =
        hardwareProducts.data?.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0) || 0;

      setData({
        totalProducts: products.data?.length || 0,
        totalCustomers: customers.count || 0,
        totalBills: bills.count || 0,
        totalRevenue,
        lowStockCount: lowStock.data?.length || 0,
        recentBills: recentBills.data || [],
        lowStockProducts: lowStock.data || [],
        categoryBreakdown: [
          { category: 'Optical', count: opticalCount, value: opticalValue },
          { category: 'Hardware', count: hardwareCount, value: hardwareValue },
        ],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data.totalRevenue),
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Products in Stock',
      value: data.totalProducts.toString(),
      icon: Package,
      color: 'from-sky-500 to-blue-500',
      bg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      label: 'Customers',
      value: data.totalCustomers.toString(),
      icon: Users,
      color: 'from-violet-500 to-purple-500',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Total Bills',
      value: data.totalBills.toString(),
      icon: Receipt,
      color: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Store activity at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-xs font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} strokeWidth={2} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Low stock alert */}
      {data.lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Low Stock Alert</h3>
            <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {data.lowStockProducts.length} items
            </span>
          </div>
          <div className="space-y-2">
            {data.lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5"
              >
                <span className="text-sm font-medium text-slate-700">{p.name}</span>
                <span className="text-sm font-bold text-red-600">
                  {p.stock} left (min: {p.low_stock_threshold})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bills */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Bills</h3>
            <button
              onClick={() => onNavigate('bills')}
              className="text-sky-600 text-sm font-medium flex items-center gap-1 hover:text-sky-700"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {data.recentBills.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No bills yet. Create your first bill to get started.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {data.recentBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{bill.bill_number || '—'}</p>
                    <p className="text-xs text-slate-400">{bill.customer_name} · {formatDateTime(bill.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(bill.total)}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        bill.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {bill.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Inventory by Category</h3>
          </div>
          <div className="p-5 space-y-4">
            {data.categoryBreakdown.map((cat) => {
              const total = data.categoryBreakdown.reduce((s, c) => s + c.count, 0) || 1;
              const pct = Math.round((cat.count / total) * 100);
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${cat.category === 'Optical' ? 'bg-sky-500' : 'bg-amber-500'}`} />
                      <span className="text-sm font-medium text-slate-700">{cat.category}</span>
                    </div>
                    <span className="text-sm text-slate-500">{cat.count} products · {formatCurrency(cat.value)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.category === 'Optical' ? 'bg-sky-500' : 'bg-amber-500'} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={() => onNavigate('inventory')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> Manage Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
