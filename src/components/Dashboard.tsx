import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, ShoppingBag, Wallet, CreditCard, Smartphone, Clock, Plus, Minus, Calendar } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { useBranch } from '../context/BranchContext';

interface DashboardData {
  totalSales: number;
  totalExpenses: number;
  salesCount: number;
  netProfit: number;
  paymentBreakdown: {
    cash: number;
    bank: number;
    telebirr: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  stockValue: number;
  lowStockCount: number;
  productCount: number;
  expiringProducts: Array<{
    id: string;
    name: string;
    expiry_date: string;
    daysUntilExpiry: number;
  }>;
}

interface ActivityEntry {
  id: string;
  type: 'product_created' | 'product_deleted' | 'stock_adjustment' | 'sale' | 'sale_reversed' | 'expense' | 'expense_deleted';
  productName?: string;
  details: string;
  timestamp: string;
  metadata: any;
}

type DateRange = 'today' | 'week' | '2weeks' | 'month' | 'year';

interface DashboardProps {
  isAdmin: boolean;
}

export function Dashboard({ isAdmin }: DashboardProps) {
  const { currentBranchId } = useBranch();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([]);
  const [activityPage, setActivityPage] = useState(0);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);
  const ACTIVITY_PAGE_SIZE = 5;

  const fetchDashboard = async () => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '2weeks':
          startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0));
      }

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('menal_sales')
        .select('*, menal_sale_items(*)')
        .eq('branch_id', currentBranchId)
        .gte('created_at', startDate.toISOString())
        .eq('is_reversed', false);

      if (salesError) {
        if (salesError.code === '42703' || salesError.code === '42P01') {
          console.error('Database schema error:', salesError);
          toast.error('Database not set up. Please run the SQL schema in Supabase Dashboard. See SUPABASE_SETUP_GUIDE.md');
          return;
        }
        throw salesError;
      }

      // Fetch expenses data
      const { data: expensesData, error: expensesError } = await supabase
        .from('menal_expenses')
        .select('*')
        .eq('branch_id', currentBranchId)
        .gte('date', startDate.toISOString());

      if (expensesError) throw expensesError;

      // Fetch products for stock info
      const { data: productsData, error: productsError } = await supabase
        .from('menal_products')
        .select('*')
        .eq('branch_id', currentBranchId);

      if (productsError) throw productsError;

      // Calculate metrics
      const totalSales = salesData?.reduce((sum, sale) => sum + sale.final_total, 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
      const salesCount = salesData?.length || 0;
      const netProfit = totalSales - totalExpenses;

      // Payment breakdown - Handle both single and split payments
      const paymentBreakdown = {
        cash: 0,
        bank: 0,
        telebirr: 0,
      };

      // Calculate payment breakdown from payment_details
      salesData?.forEach(sale => {
        if (!sale.is_reversed && sale.payment_details) {
          // Use payment_details which contains the actual amounts for each method
          const details = sale.payment_details;
          paymentBreakdown.cash += details.cash || 0;
          paymentBreakdown.bank += details.bank || 0;
          paymentBreakdown.telebirr += details.telebirr || 0;
        }
      });

      // Top products
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

      salesData?.forEach(sale => {
        sale.menal_sale_items?.forEach((item: any) => {
          if (!productSales[item.product_id]) {
            productSales[item.product_id] = {
              name: item.product_name,
              quantity: 0,
              revenue: 0,
            };
          }
          productSales[item.product_id].quantity += item.quantity;
          productSales[item.product_id].revenue += item.total;
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Stock metrics
      const stockValue = productsData?.reduce((sum, p) => sum + (p.stock * p.price), 0) || 0;
      const lowStockCount = productsData?.filter(p => p.min_stock > 0 && p.stock <= p.min_stock).length || 0;
      const productCount = productsData?.length || 0;

      // Expiring products
      const expiringProducts = productsData?.filter(p => p.expiry_date)
        .map(p => ({
          id: p.id,
          name: p.name,
          expiry_date: p.expiry_date,
          daysUntilExpiry: Math.ceil((new Date(p.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }))
        .filter(p => p.daysUntilExpiry <= 180 && p.daysUntilExpiry > 0) // Show products expiring in the next 6 months
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry) || [];

      setData({
        totalSales,
        totalExpenses,
        salesCount,
        netProfit,
        paymentBreakdown,
        topProducts,
        stockValue,
        lowStockCount,
        productCount,
        expiringProducts,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async (page = 0) => {
    if (!currentBranchId) return;
    try {
      const from = page * ACTIVITY_PAGE_SIZE;
      const to = from + ACTIVITY_PAGE_SIZE - 1;

      const { data: activities, error, count } = await supabase
        .from('menal_activity_log')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42703' || error.code === '42P01') {
          console.log('Activity log not available yet');
          return;
        }
        throw error;
      }

      const mappedActivities = activities?.map(activity => ({
        id: activity.id,
        type: activity.type,
        productName: activity.metadata?.productName,
        details: activity.details,
        timestamp: activity.created_at,
        metadata: activity.metadata
      })) || [];

      if (activities.length < ACTIVITY_PAGE_SIZE) {
        setHasMoreActivities(false);
      } else {
        setHasMoreActivities(true);
      }

      setRecentActivities(mappedActivities);
      setTotalActivitiesCount(count || 0);
    } catch (error) {
      console.error('Activities fetch error:', error);
    }
  };

  useEffect(() => {
    fetchDashboard();
    setActivityPage(0);
    fetchRecentActivities(0);
  }, [dateRange, currentBranchId]);

  const handleNextActivityPage = () => {
    const nextPage = activityPage + 1;
    setActivityPage(nextPage);
    fetchRecentActivities(nextPage);
  };

  const handlePrevActivityPage = () => {
    const prevPage = Math.max(0, activityPage - 1);
    setActivityPage(prevPage);
    fetchRecentActivities(prevPage);
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-primary)' }}>Failed to load data</p>
      </div>
    );
  }

  const dateRangeLabels: Record<DateRange, string> = {
    today: 'Today',
    week: 'Week',
    '2weeks': '2 Weeks',
    month: 'Month',
    year: 'Year',
  };

  return (
    <div>
      {/* Welcome Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
      </div>

      {/* Date Range Selector */}
      <div style={{ marginBottom: '24px' }}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(Object.keys(dateRangeLabels) as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className="px-5 py-2.5 rounded-lg whitespace-nowrap transition-all text-sm"
              style={{
                backgroundColor: dateRange === range ? 'var(--primary)' : 'var(--gray-light)',
                color: dateRange === range ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${dateRange === range ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {dateRangeLabels[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Profit Card - Reduced */}
      {isAdmin && (
        <div
          className="rounded-2xl shadow-sm"
          style={{
            backgroundColor: data.netProfit >= 0 ? 'var(--success)' : 'var(--danger)',
            padding: '20px',
            marginBottom: '16px'
          }}
        >
          <p className="text-sm" style={{ color: '#FFFFFF', opacity: 0.9, marginBottom: '8px' }}>Net Profit</p>
          <h1 style={{ color: '#FFFFFF', fontSize: '28px' }}>{data.netProfit.toFixed(2)} Birr</h1>
          <p className="text-xs mt-1" style={{ color: '#FFFFFF', opacity: 0.8 }}>
            {data.netProfit >= 0 ? 'Keep it up!' : 'Check expenses'}
          </p>
        </div>
      )}

      {/* Sales & Expenses - Reduced Height */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div
          className="rounded-2xl shadow-sm border"
          style={{ backgroundColor: 'var(--gray-light)', borderColor: 'var(--border)', padding: '16px' }}
        >
          <div style={{ marginBottom: '10px' }}>
            <TrendingUp size={20} style={{ color: 'var(--success)' }} />
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Sales</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
            {data.totalSales.toFixed(2)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
          </p>
        </div>

        <div
          className="rounded-2xl shadow-sm border"
          style={{ backgroundColor: 'var(--gray-light)', borderColor: 'var(--border)', padding: '16px' }}
        >
          <div style={{ marginBottom: '10px' }}>
            <TrendingDown size={20} style={{ color: 'var(--danger)' }} />
          </div>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Expenses</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
            {data.totalExpenses.toFixed(2)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
          </p>
        </div>
      </div>

      {/* Sales Count & Stock Value - Reduced Height */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '20px' }}>
        <div
          className="rounded-2xl shadow-sm border"
          style={{ backgroundColor: 'var(--secondary)', borderColor: 'var(--border)', padding: '16px' }}
        >
          <div style={{ marginBottom: '10px' }}>
            <ShoppingBag size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <p className="text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Sales Count</p>
          <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '600' }}>
            {data.salesCount} <span className="text-xs" style={{ opacity: 0.8 }}>sales</span>
          </p>
        </div>

        {isAdmin && (
          <div
            className="rounded-2xl shadow-sm border"
            style={{ backgroundColor: 'var(--secondary)', borderColor: 'var(--border)', padding: '16px' }}
          >
            <div style={{ marginBottom: '10px' }}>
              <Package size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <p className="text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Stock Value</p>
            <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '600' }}>
              {data.stockValue.toFixed(2)} <span className="text-xs" style={{ opacity: 0.8 }}>br</span>
            </p>
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {data.lowStockCount > 0 && (
        <div
          className="rounded-2xl shadow-sm border flex items-start"
          style={{
            backgroundColor: '#FFF9F5',
            borderColor: 'var(--warning)',
            padding: '20px',
            gap: '16px',
            marginBottom: '28px'
          }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--warning)' }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p style={{ color: 'var(--text-primary)' }}>
              {data.lowStockCount} product{data.lowStockCount > 1 ? 's' : ''} low on stock
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Check Products tab to restock
            </p>
          </div>
        </div>
      )}

      {/* Expiry Alert */}
      {data.expiringProducts.length > 0 && (
        <div
          className="rounded-2xl shadow-sm border flex items-start"
          style={{
            backgroundColor: '#FFF9F5',
            borderColor: 'var(--warning)',
            padding: '20px',
            gap: '16px',
            marginBottom: '28px'
          }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--warning)' }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p style={{ color: 'var(--text-primary)' }}>
              {data.expiringProducts.length} product{data.expiringProducts.length > 1 ? 's' : ''} expiring soon
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              Check Products tab to manage expiry
            </p>
          </div>
        </div>
      )}

      {/* Payment Breakdown - Compact */}
      <div
        className="rounded-2xl shadow-sm border"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
          padding: '20px',
          marginBottom: '20px'
        }}
      >
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '14px', fontSize: '16px' }}>Payment Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            className="flex items-center justify-between rounded-lg"
            style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--primary)'
                }}
              >
                <Wallet size={16} style={{ color: '#FFFFFF' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Cash</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {((data.paymentBreakdown.cash / (data.totalSales || 1)) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {data.paymentBreakdown.cash.toFixed(2)}
            </p>
          </div>

          <div
            className="flex items-center justify-between rounded-lg"
            style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--secondary)'
                }}
              >
                <CreditCard size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Bank</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {((data.paymentBreakdown.bank / (data.totalSales || 1)) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {data.paymentBreakdown.bank.toFixed(2)}
            </p>
          </div>

          <div
            className="flex items-center justify-between rounded-lg"
            style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--success)'
                }}
              >
                <Smartphone size={16} style={{ color: '#FFFFFF' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Telebirr</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {((data.paymentBreakdown.telebirr / (data.totalSales || 1)) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {data.paymentBreakdown.telebirr.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <div
          className="rounded-2xl shadow-sm border"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            padding: '24px',
            marginBottom: '20px'
          }}
        >
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Top Products</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.topProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center rounded-xl"
                style={{ backgroundColor: 'var(--gray-light)', padding: '16px', gap: '16px' }}
              >
                <div
                  className="rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '44px',
                    height: '44px',
                    backgroundColor: 'var(--secondary)'
                  }}
                >
                  <span style={{ color: 'var(--primary)' }}>#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {product.quantity} units
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ color: 'var(--text-primary)' }}>
                    {product.revenue.toFixed(2)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Birr</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.topProducts.length === 0 && (
        <div
          className="rounded-2xl shadow-sm border text-center"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            padding: '40px',
            marginBottom: '20px'
          }}
        >
          <ShoppingBag size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-primary)' }}>No sales yet</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Start selling to see your top products
          </p>
        </div>
      )}

      {/* Recent Activities */}
      {recentActivities.length > 0 && (
        <div
          className="rounded-2xl shadow-sm border"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            padding: '24px'
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <Clock size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ color: 'var(--text-primary)' }}>Recent Activities</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentActivities.map((activity) => {
              const isSale = activity.type === 'sale';

              return (
                <div
                  key={activity.id}
                  className="flex items-start rounded-xl p-4 transition-all hover:bg-gray-50 border border-transparent hover:border-gray-200"
                  style={{ backgroundColor: 'var(--gray-light)', gap: '12px' }}
                >
                  <div
                    className={`rounded-full flex items-center justify-center flex-shrink-0 ${isSale ? 'bg-green-100' : 'bg-blue-100'}`}
                    style={{
                      width: '40px',
                      height: '40px',
                      color: isSale ? 'var(--success)' : 'var(--primary)'
                    }}
                  >
                    {isSale ? <ShoppingBag size={20} /> : <Package size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                          {isSale
                            ? (() => {
                              const items = activity.metadata?.items || [];
                              const names = items.slice(0, 3).map((item: any) => item.productName);
                              let title = names.join(', ');
                              if (items.length > 3) title += '...';
                              return `Sale: ${title || 'Items'} (${Math.round(activity.metadata?.finalTotal || 0)})`;
                            })()
                            : activity.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {isSale && activity.metadata?.items
                            ? (() => {
                              const itemCount = (activity.metadata.items as any[]).reduce((sum, item) => sum + (item.quantity || 0), 0);
                              const methods = [];
                              const details = activity.metadata.paymentDetails;
                              if (details) {
                                if (details.cash > 0) methods.push(`Cash(${Math.round(details.cash)})`);
                                if (details.bank > 0) methods.push(`Bank(${Math.round(details.bank)})`);
                                if (details.telebirr > 0) methods.push(`Telebirr(${Math.round(details.telebirr)})`);
                              }

                              const paymentLabel = methods.length > 0 ? methods.join(' + ') : (activity.metadata.paymentMethod || 'Cash');
                              return `${itemCount} items • ${paymentLabel}`;
                            })()
                            : activity.details}
                        </p>
                      </div>
                      <span className="text-xs whitespace-nowrap ml-2" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(activity.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activities Pagination Controls */}
          <div className="flex flex-col items-center gap-3 mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Showing {Math.min(totalActivitiesCount, activityPage * ACTIVITY_PAGE_SIZE + 1)}-{Math.min((activityPage + 1) * ACTIVITY_PAGE_SIZE, totalActivitiesCount)} of {totalActivitiesCount}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevActivityPage}
                disabled={activityPage === 0 || loading}
                className="pagination-btn"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Previous
              </button>

              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                Page {activityPage + 1} of {Math.ceil(totalActivitiesCount / ACTIVITY_PAGE_SIZE) || 1}
              </span>

              <button
                onClick={handleNextActivityPage}
                disabled={!hasMoreActivities || loading}
                className="pagination-btn"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// End of Dashboard component