import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, TrendingUp, CreditCard, Landmark, Smartphone, CalendarDays, Receipt } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import { LoadingSpinner } from './LoadingSpinner';

export function Reports() {
  const { currentBranchId } = useBranch();
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Set to first of month
    return d;
  });
  
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD" format

  // Data Loading
  useEffect(() => {
    if (currentBranchId) {
      loadData();
    }
  }, [currentDate, currentBranchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const { data, error } = await supabase
        .from('menal_sales')
        .select('*, menal_sale_items(*)')
        .eq('branch_id', currentBranchId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('is_reversed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSalesData(data || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() - 1);
      return next;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + 1);
      return next;
    });
  };

  // KPI Calculations
  let totalSales = 0;
  let totalCash = 0;
  let totalBank = 0;
  let totalTelebirr = 0;
  
  const daysWithSales = new Set<string>();

  salesData.forEach(sale => {
    totalSales += sale.final_total;
    if (sale.payment_details) {
      totalCash += sale.payment_details.cash || 0;
      totalBank += sale.payment_details.bank || 0;
      totalTelebirr += sale.payment_details.telebirr || 0;
    } else {
      // Fallback if legacy
      if (sale.payment_method === 'cash') totalCash += sale.final_total;
      if (sale.payment_method === 'bank') totalBank += sale.final_total;
      if (sale.payment_method === 'telebirr') totalTelebirr += sale.final_total;
    }
    
    // Track unique days for Avg/Day calculation
    const dateStr = new Date(sale.created_at).toISOString().split('T')[0];
    daysWithSales.add(dateStr);
  });

  const avgPerDay = daysWithSales.size > 0 ? totalSales / daysWithSales.size : 0;

  // Daily Breakdown Calculation
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const dailyData: Record<string, { total: number; count: number; cash: number; bank: number; telebirr: number; dateStr: string }> = {};

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
    const dateStr = d.toISOString().split('T')[0]; // "YYYY-MM-DD"
    dailyData[dateStr] = { total: 0, count: 0, cash: 0, bank: 0, telebirr: 0, dateStr };
  }

  salesData.forEach(sale => {
    const dateStr = new Date(sale.created_at).toISOString().split('T')[0];
    if (dailyData[dateStr]) {
      dailyData[dateStr].total += sale.final_total;
      dailyData[dateStr].count += 1;
      
      if (sale.payment_details) {
        dailyData[dateStr].cash += sale.payment_details.cash || 0;
        dailyData[dateStr].bank += sale.payment_details.bank || 0;
        dailyData[dateStr].telebirr += sale.payment_details.telebirr || 0;
      } else {
        if (sale.payment_method === 'cash') dailyData[dateStr].cash += sale.final_total;
        if (sale.payment_method === 'bank') dailyData[dateStr].bank += sale.final_total;
        if (sale.payment_method === 'telebirr') dailyData[dateStr].telebirr += sale.final_total;
      }
    }
  });

  const dailyList = Object.values(dailyData).sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  // Modals Data
  const selectedDaySales = selectedDay ? salesData.filter(sale => {
    const dateStr = new Date(sale.created_at).toISOString().split('T')[0];
    return dateStr === selectedDay;
  }) : [];

  const formatCurrency = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatMonthYear = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const formatTime = (isoStr: string) => new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div style={{ paddingBottom: '20px' }}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
        <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-black/5 transition-colors">
          <ChevronLeft size={24} style={{ color: 'var(--text-primary)' }} />
        </button>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {formatMonthYear(currentDate)}
        </h2>
        <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-black/5 transition-colors" disabled={
          currentDate.getFullYear() === new Date().getFullYear() && currentDate.getMonth() === new Date().getMonth()
        }>
          <ChevronRight size={24} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading reports..." />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <KpiCard title="Total Sales" value={totalSales} icon={<TrendingUp size={18} />} color="var(--primary)" isCurrency />
            <KpiCard title="Cash" value={totalCash} icon={<Receipt size={18} />} color="var(--success)" isCurrency />
            <KpiCard title="Bank" value={totalBank} icon={<Landmark size={18} />} color="#3b82f6" isCurrency />
            <KpiCard title="Telebirr" value={totalTelebirr} icon={<Smartphone size={18} />} color="#8b5cf6" isCurrency />
            <KpiCard title="Avg/Day" value={avgPerDay} icon={<CalendarDays size={18} />} color="var(--text-primary)" isCurrency />
          </div>

          {/* Daily Sales List */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--gray-light)' }}>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Daily Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold text-right">Sales Count</th>
                    <th className="p-3 font-semibold text-right">Cash</th>
                    <th className="p-3 font-semibold text-right">Bank</th>
                    <th className="p-3 font-semibold text-right">Telebirr</th>
                    <th className="p-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyList.map((day) => (
                    <tr 
                      key={day.dateStr} 
                      onClick={() => setSelectedDay(day.dateStr)}
                      className="transition-colors cursor-pointer"
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: day.count > 0 ? 'transparent' : 'var(--gray-light)',
                        opacity: day.count > 0 ? 1 : 0.6
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-light)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = day.count > 0 ? 'transparent' : 'var(--gray-light)'}
                    >
                      <td className="p-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {new Date(day.dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-3 text-right" style={{ color: 'var(--text-secondary)' }}>{day.count}</td>
                      <td className="p-3 text-right" style={{ color: 'var(--success)' }}>{day.cash > 0 ? formatCurrency(day.cash) : '-'}</td>
                      <td className="p-3 text-right" style={{ color: '#3b82f6' }}>{day.bank > 0 ? formatCurrency(day.bank) : '-'}</td>
                      <td className="p-3 text-right" style={{ color: '#8b5cf6' }}>{day.telebirr > 0 ? formatCurrency(day.telebirr) : '-'}</td>
                      <td className="p-3 text-right font-bold" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(day.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Day Detail Modal */}
      {selectedDay && (
        <div 
          className="fixed inset-0 z-50 flex flex-col" 
          style={{ backgroundColor: 'var(--background)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Details for {new Date(selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <button 
              onClick={() => setSelectedDay(null)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto p-4">
            {selectedDaySales.length === 0 ? (
              <div className="text-center py-12">
                <Receipt size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No Sales</h3>
                <p style={{ color: 'var(--text-secondary)' }}>There were no transactions recorded on this date.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--gray-light)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <th className="p-3 font-semibold">Time</th>
                        <th className="p-3 font-semibold">Products</th>
                        <th className="p-3 font-semibold">Payment Methods</th>
                        <th className="p-3 font-semibold text-right">Cash</th>
                        <th className="p-3 font-semibold text-right">Bank</th>
                        <th className="p-3 font-semibold text-right">Telebirr</th>
                        <th className="p-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDaySales.map(sale => {
                        const itemsStr = sale.menal_sale_items?.map((item: any) => `${item.product_name} (x${item.quantity})`).join(', ') || 'Unknown Items';
                        
                        let paymentStr = [];
                        let c = 0, b = 0, t = 0;
                        if (sale.payment_details) {
                          if (sale.payment_details.cash) { c = sale.payment_details.cash; paymentStr.push(`Cash ${formatCurrency(c)}`); }
                          if (sale.payment_details.bank) { b = sale.payment_details.bank; paymentStr.push(`Bank ${formatCurrency(b)}`); }
                          if (sale.payment_details.telebirr) { t = sale.payment_details.telebirr; paymentStr.push(`Telebirr ${formatCurrency(t)}`); }
                        } else {
                          paymentStr.push(sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1));
                          if (sale.payment_method === 'cash') c = sale.final_total;
                          if (sale.payment_method === 'bank') b = sale.final_total;
                          if (sale.payment_method === 'telebirr') t = sale.final_total;
                        }

                        return (
                          <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{formatTime(sale.created_at)}</td>
                            <td className="p-3" style={{ color: 'var(--text-primary)', maxWidth: '250px', whiteSpace: 'normal' }}>
                              {itemsStr}
                            </td>
                            <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{paymentStr.join(' + ')}</td>
                            <td className="p-3 text-right" style={{ color: 'var(--success)' }}>{c > 0 ? formatCurrency(c) : '-'}</td>
                            <td className="p-3 text-right" style={{ color: '#3b82f6' }}>{b > 0 ? formatCurrency(b) : '-'}</td>
                            <td className="p-3 text-right" style={{ color: '#8b5cf6' }}>{t > 0 ? formatCurrency(t) : '-'}</td>
                            <td className="p-3 text-right font-bold" style={{ color: 'var(--primary)' }}>{formatCurrency(sale.final_total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon, color, isCurrency }: { title: string; value: number; icon: React.ReactNode; color: string; isCurrency: boolean }) {
  return (
    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15`, color: color }}>
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
