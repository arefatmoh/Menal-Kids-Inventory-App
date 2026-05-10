import { useEffect, useState } from 'react';
import { Package, ShoppingCart, DollarSign, Plus, TrendingUp, TrendingDown, RotateCcw, X, Check, Minus, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

interface SaleItemRecord {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  returned_quantity: number;
}

interface HistoryEntry {
  id: string;
  type: 'product_created' | 'product_deleted' | 'stock_adjustment' | 'sale' | 'sale_reversed' | 'expense' | 'expense_deleted';
  productId?: string;
  productName?: string;
  saleId?: string;
  expenseId?: string;
  details: string;
  timestamp: string;
  metadata: any;
}

interface HistoryViewProps {
  userRole?: string;
  username?: string;
}

export function HistoryView({ userRole = 'admin', username = '' }: HistoryViewProps) {
  const { currentBranchId } = useBranch();
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  // Return/Refund states
  const [saleItems, setSaleItems] = useState<SaleItemRecord[]>([]);
  const [returnModal, setReturnModal] = useState<{ item: SaleItemRecord; maxQty: number } | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnProcessing, setReturnProcessing] = useState(false);
  const [showReturnAllConfirm, setShowReturnAllConfirm] = useState(false);

  const fetchHistory = async (pageNumber: number, reset = false) => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(); // now

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          startDate = customStartDate ? new Date(customStartDate) : new Date(now.setHours(0, 0, 0, 0));
          endDate = customEndDate ? new Date(customEndDate) : new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0));
      }

      const { data, error, count } = await supabase
        .from('menal_activity_log')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42703' || error.code === '42P01') {
          console.error('Database schema error:', error);
          toast.error('Database not set up.');
          setHistory([]);
          return;
        }
        throw error;
      }

      const mappedHistory = (data || []).map(h => ({
        id: h.id,
        type: h.type,
        productId: h.product_id,
        productName: h.metadata?.productName,
        saleId: h.sale_id,
        expenseId: h.expense_id,
        details: h.details,
        timestamp: h.created_at,
        metadata: h.metadata || {},
      }));

      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true); // Reset if we got a full page, though usually implies more might exist
      }

      setHistory(mappedHistory);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('History fetch error:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchHistory(0, true);
  }, [currentBranchId, dateRange, customStartDate, customEndDate]);

  // Fetch sale items when a sale entry is selected
  useEffect(() => {
    if (selectedEntry?.type === 'sale' && selectedEntry.saleId) {
      fetchSaleItems(selectedEntry.saleId);
    } else {
      setSaleItems([]);
    }
  }, [selectedEntry]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, false);
  };

  // Fetch sale items from DB (includes returned_quantity)
  const fetchSaleItems = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('menal_sale_items')
        .select('*')
        .eq('sale_id', saleId);
      if (error) throw error;
      setSaleItems((data || []).map(d => ({ ...d, returned_quantity: d.returned_quantity || 0 })));
    } catch (err) {
      console.error('Failed to fetch sale items:', err);
      setSaleItems([]);
    }
  };

  // Partial return of a single item
  const handlePartialReturn = async () => {
    if (!returnModal || !selectedEntry?.saleId) return;
    setReturnProcessing(true);
    try {
      if (isAdmin) {
        // Admin: execute immediately
        const { data, error } = await supabase.rpc('menal_partial_return_item', {
          p_branch_id: currentBranchId,
          p_sale_id: selectedEntry.saleId,
          p_sale_item_id: returnModal.item.id,
          p_return_quantity: returnQty
        });
        if (error) throw error;
        toast.success(`Returned ${returnQty}x ${returnModal.item.product_name}. Deducted ${Math.round(data.deduction)} br`);
      } else {
        // Staff: create pending request
        const deduction = returnModal.item.price * returnQty;
        const { error } = await supabase.from('menal_return_requests').insert({
          branch_id: currentBranchId,
          sale_id: selectedEntry.saleId,
          sale_item_id: returnModal.item.id,
          return_quantity: returnQty,
          deduction_amount: deduction,
          product_name: returnModal.item.product_name,
          requested_by: username,
          status: 'pending',
          metadata: {
            unit_price: returnModal.item.price,
            original_quantity: returnModal.item.quantity,
          }
        });
        if (error) throw error;
        toast.success('Return request sent for admin approval');
      }

      setReturnModal(null);
      setReturnQty(1);
      if (isAdmin) {
        await fetchSaleItems(selectedEntry.saleId);
        fetchHistory(page, true);
      }
    } catch (err: any) {
      console.error('Partial return error:', err);
      toast.error(err.message || 'Failed to process return');
    } finally {
      setReturnProcessing(false);
    }
  };

  // Return all remaining items in a sale
  const handleReturnAll = async () => {
    if (!selectedEntry?.saleId) return;
    setReturnProcessing(true);
    setShowReturnAllConfirm(false);
    try {
      if (isAdmin) {
        // Admin: execute each item immediately
        for (const item of saleItems) {
          const remaining = item.quantity - item.returned_quantity;
          if (remaining > 0) {
            const { error } = await supabase.rpc('menal_partial_return_item', {
              p_branch_id: currentBranchId,
              p_sale_id: selectedEntry.saleId,
              p_sale_item_id: item.id,
              p_return_quantity: remaining
            });
            if (error) throw error;
          }
        }
        toast.success('All items returned and restocked successfully!');
      } else {
        // Staff: create a single pending request for "return all"
        const totalDeduction = saleItems.reduce((sum, item) => {
          const remaining = item.quantity - item.returned_quantity;
          return sum + (remaining > 0 ? item.price * remaining : 0);
        }, 0);
        const itemNames = saleItems
          .filter(i => (i.quantity - i.returned_quantity) > 0)
          .map(i => `${i.quantity - i.returned_quantity}x ${i.product_name}`)
          .join(', ');

        const { error } = await supabase.from('menal_return_requests').insert({
          branch_id: currentBranchId,
          sale_id: selectedEntry.saleId,
          sale_item_id: null,
          return_quantity: saleItems.reduce((sum, i) => sum + Math.max(0, i.quantity - i.returned_quantity), 0),
          deduction_amount: totalDeduction,
          product_name: itemNames || 'All items',
          requested_by: username,
          status: 'pending',
          metadata: {
            item_count: saleItems.filter(i => (i.quantity - i.returned_quantity) > 0).length,
          }
        });
        if (error) throw error;
        toast.success('Return-all request sent for admin approval');
      }

      setSelectedEntry(null);
      if (isAdmin) fetchHistory(page, true);
    } catch (err: any) {
      console.error('Return all error:', err);
      toast.error(err.message || 'Failed to return all items');
    } finally {
      setReturnProcessing(false);
    }
  };

  const handleReverseSale = async (saleId: string) => {
    if (!confirm('Are you sure you want to reverse this sale? Products will be returned to inventory.')) return;

    try {
      const { error } = await supabase
        .rpc('menal_reverse_sale', {
          p_branch_id: currentBranchId,
          p_sale_id: saleId
        });

      if (error) throw error;

      setSelectedEntry(null);
      fetchHistory(page, true);
      toast.success('Sale reversed successfully!');
    } catch (error) {
      console.error('Reverse sale error:', error);
      toast.error('Failed to reverse sale');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'product_created':
      case 'product_deleted':
        return <Package size={16} style={{ color: 'var(--primary)' }} />;
      case 'stock_adjustment':
        return <TrendingUp size={16} style={{ color: 'var(--success)' }} />;
      case 'sale':
        return <ShoppingCart size={16} style={{ color: 'var(--success)' }} />;
      case 'sale_reversed':
        return <RotateCcw size={16} style={{ color: 'var(--warning)' }} />;
      case 'expense':
      case 'expense_deleted':
        return <DollarSign size={16} style={{ color: 'var(--danger)' }} />;
      default:
        return <Package size={16} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'product_created':
        return 'Product Created';
      case 'product_deleted':
        return 'Product Deleted';
      case 'stock_adjustment':
        return 'Stock Adjustment';
      case 'sale':
        return 'Sale';
      case 'sale_reversed':
        return 'Sale Reversed';
      case 'expense':
        return 'Expense';
      case 'expense_deleted':
        return 'Expense Deleted';
      default:
        return type;
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading history..." />;
  }

  // Filter history based on selected type
  const filteredHistory = filterType === 'all'
    ? history
    : history.filter(entry => entry.type === filterType);

  // Get unique filter types
  const filterTypes = ['all', 'sale', 'expense', 'stock_adjustment', 'product_created'];

  return (
    <div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>History</h2>

      {history.length === 0 ? (
        <div className="text-center rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '40px 20px' }}>
          <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>No activity yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            All your sales, inventory changes, and expenses will appear here
          </p>
        </div>
      ) : (
        <>
          {/* Timeline Range Selector */}
          <div style={{ marginBottom: '16px', width: '100%', maxWidth: '100%' }}>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <style>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {['today', 'yesterday', 'week', 'month', 'year', 'custom'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className="px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm capitalize"
                  style={{
                    backgroundColor: dateRange === range ? 'var(--primary)' : 'var(--gray-light)',
                    color: dateRange === range ? '#FFFFFF' : 'var(--text-primary)',
                    border: `1px solid ${dateRange === range ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : range}
                </button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="flex gap-2 mt-3 items-center">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--gray-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--gray-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}
          </div>

          {/* Type Filter Chips */}
          <div
            className="flex gap-2"
            style={{
              marginBottom: '12px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <style>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <button
              onClick={() => setFilterType('all')}
              className="px-3 py-1.5 rounded-lg transition-all text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: filterType === 'all' ? 'var(--primary)' : 'var(--gray-light)',
                color: filterType === 'all' ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${filterType === 'all' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('sale')}
              className="px-3 py-1.5 rounded-lg transition-all text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: filterType === 'sale' ? 'var(--primary)' : 'var(--gray-light)',
                color: filterType === 'sale' ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${filterType === 'sale' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              Sales
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className="px-3 py-1.5 rounded-lg transition-all text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: filterType === 'expense' ? 'var(--primary)' : 'var(--gray-light)',
                color: filterType === 'expense' ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${filterType === 'expense' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              Expenses
            </button>
            <button
              onClick={() => setFilterType('stock_adjustment')}
              className="px-3 py-1.5 rounded-lg transition-all text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: filterType === 'stock_adjustment' ? 'var(--primary)' : 'var(--gray-light)',
                color: filterType === 'stock_adjustment' ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${filterType === 'stock_adjustment' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              Stock
            </button>
            <button
              onClick={() => setFilterType('product_created')}
              className="px-3 py-1.5 rounded-lg transition-all text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: filterType === 'product_created' ? 'var(--primary)' : 'var(--gray-light)',
                color: filterType === 'product_created' ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${filterType === 'product_created' ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              Products
            </button>
          </div>

          {/* Compact History Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredHistory.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="w-full text-left rounded-lg shadow-sm border transition-all active:scale-98"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  padding: '12px'
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="rounded p-1.5 flex-shrink-0"
                    style={{ backgroundColor: 'var(--gray-light)' }}
                  >
                    {getIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2" style={{ marginBottom: '2px' }}>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {getTypeLabel(entry.type)}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p
                      className="text-sm"
                      style={{
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {entry.type === 'sale' ? (
                        (() => {
                          const items = entry.metadata?.items || [];
                          const names = items.slice(0, 3).map((item: any) => item.productName);
                          let title = names.join(', ');
                          if (items.length > 3) title += '...';
                          return `Sale: ${title || 'Items'}`;
                        })()
                      ) : (
                        entry.details
                      )}
                    </p>
                    {entry.metadata?.finalTotal && (
                      <p className="text-xs mt-1" style={{ color: 'var(--primary)' }}>
                        {Math.round(entry.metadata.finalTotal || 0)} <span style={{ opacity: 0.7 }}>br</span>
                      </p>
                    )}
                    {entry.metadata?.amount !== undefined && (
                      <p className="text-xs mt-1" style={{ color: entry.type === 'stock_adjustment' ? (entry.metadata.amount > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--danger)' }}>
                        {entry.type === 'stock_adjustment' ? (entry.metadata.amount > 0 ? '+' : '') : ''}{Math.round(entry.metadata.amount || 0)} <span style={{ opacity: 0.7 }}>{entry.type === 'stock_adjustment' ? 'units' : 'br'}</span>
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Showing {Math.min(totalCount, page * PAGE_SIZE + 1)}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  const prevPage = Math.max(0, page - 1);
                  setPage(prevPage);
                  fetchHistory(prevPage);
                }}
                disabled={page === 0 || loading}
                className="pagination-btn"
              >
                Previous
              </button>

              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
              </span>

              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchHistory(nextPage);
                }}
                disabled={!hasMore || loading}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          </div>
          {filteredHistory.length === 0 && (
            <div className="text-center rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '30px 20px' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No {filterType} activities found
              </p>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', paddingTop: '24px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '90px' }} onClick={() => { setSelectedEntry(null); setReturnModal(null); setShowReturnAllConfirm(false); }}>
          <div
            className="w-full max-w-md rounded-xl shadow-2xl overflow-y-auto"
            style={{ backgroundColor: 'var(--background)', maxHeight: 'calc(100vh - 120px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '16px' }}>
              <div className="flex items-center gap-2">
                <div
                  className="rounded p-1.5"
                  style={{ backgroundColor: 'var(--gray-light)' }}
                >
                  {getIcon(selectedEntry.type)}
                </div>
                <span style={{ color: 'var(--text-primary)' }}>{getTypeLabel(selectedEntry.type)}</span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg transition-all active:scale-95"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Time</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(selectedEntry.timestamp)}</p>
              </div>

              <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Details</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.details}</p>
              </div>

              {/* Sale Details */}
              {selectedEntry.type === 'sale' && selectedEntry.metadata && (
                <>
                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Items</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(saleItems.length > 0 ? saleItems : selectedEntry.metadata.items || []).map((item: any, idx: number) => {
                        const isDbItem = item.returned_quantity !== undefined;
                        const name = isDbItem ? item.product_name : item.productName;
                        const qty = isDbItem ? item.quantity : item.quantity;
                        const returned = isDbItem ? item.returned_quantity : 0;
                        const total = isDbItem ? item.total : item.total;
                        const remaining = qty - returned;
                        const isFullyReturned = remaining <= 0;

                        return (
                          <div key={isDbItem ? item.id : idx}>
                            <div className="flex items-center justify-between text-sm gap-2">
                              <div className="flex-1 min-w-0">
                                <span style={{ 
                                  color: isFullyReturned ? 'var(--text-secondary)' : 'var(--text-primary)',
                                  textDecoration: isFullyReturned ? 'line-through' : 'none'
                                }}>
                                  {name} x{qty}
                                </span>
                                {returned > 0 && (
                                  <span className="text-xs ml-2" style={{ color: 'var(--danger)' }}>
                                    ({returned} returned)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span style={{ color: isFullyReturned ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                  {Math.round(total)} <span style={{ opacity: 0.7 }}>br</span>
                                </span>
                                {/* Per-item return button */}
                                {!selectedEntry.metadata.reversed && isDbItem && remaining > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReturnModal({ item, maxQty: remaining });
                                      setReturnQty(1);
                                    }}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-black/10"
                                    title="Return this item"
                                    style={{ color: 'var(--danger)' }}
                                  >
                                    <RotateCcw size={15} />
                                  </button>
                                )}
                                {isFullyReturned && (
                                  <Check size={15} style={{ color: 'var(--success)' }} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inline Return & Restock Panel */}
                  {returnModal && (
                    <div className="rounded-xl border" style={{ borderColor: 'var(--danger)', backgroundColor: 'var(--background)', padding: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RotateCcw size={18} style={{ color: 'var(--danger)' }} />
                            <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Return & Restock</h4>
                          </div>
                          <button
                            onClick={() => { setReturnModal(null); setReturnQty(1); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)' }}
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {returnModal.item.product_name}
                        </p>

                        <div>
                          <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>Quantity to Return (max {returnModal.maxQty})</label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                              className="w-10 h-10 rounded-lg flex items-center justify-center border transition-colors"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            >
                              <Minus size={18} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={returnModal.maxQty}
                              value={returnQty}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) setReturnQty(Math.min(returnModal.maxQty, Math.max(1, v)));
                                else if (e.target.value === '') setReturnQty(1);
                              }}
                              className="w-20 text-center p-2 border rounded-lg text-lg font-bold"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', backgroundColor: 'var(--background)' }}
                            />
                            <button
                              onClick={() => setReturnQty(Math.min(returnModal.maxQty, returnQty + 1))}
                              className="w-10 h-10 rounded-lg flex items-center justify-center border transition-colors"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>Deduction</span>
                            <span className="font-bold" style={{ color: 'var(--danger)' }}>
                              -{Math.round(returnModal.item.price * returnQty)} <span style={{ opacity: 0.7 }}>br</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setReturnModal(null); setReturnQty(1); }}
                            disabled={returnProcessing}
                            className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePartialReturn}
                            disabled={returnProcessing}
                            className="flex-1 py-2.5 rounded-lg text-sm text-white transition-all flex items-center justify-center gap-2"
                            style={{ backgroundColor: 'var(--danger)', opacity: returnProcessing ? 0.7 : 1 }}
                          >
                            {returnProcessing ? 'Processing...' : 'Confirm Return'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <div className="flex justify-between text-sm" style={{ marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                      <span style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.total)} <span style={{ opacity: 0.7 }}>br</span></span>
                    </div>
                    {selectedEntry.metadata.discount > 0 && (
                      <div className="flex justify-between text-sm" style={{ marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                        <span style={{ color: 'var(--danger)' }}>-{Math.round(selectedEntry.metadata.discount)} <span style={{ opacity: 0.7 }}>br</span></span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm" style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>Total</span>
                      <span style={{ color: 'var(--primary)' }}>{Math.round(selectedEntry.metadata.finalTotal)} <span style={{ opacity: 0.7 }}>br</span></span>
                    </div>
                  </div>

                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Payment Method</p>
                    <p className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
                      {(() => {
                        if (selectedEntry.metadata.paymentDetails) {
                          const details = selectedEntry.metadata.paymentDetails;
                          const methods: string[] = [];
                          if (details.cash > 0) methods.push(`Cash(${Math.round(details.cash)})`);
                          if (details.bank > 0) methods.push(`Bank(${Math.round(details.bank)})`);
                          if (details.telebirr > 0) methods.push(`Telebirr(${Math.round(details.telebirr)})`);
                          return methods.length > 0 ? methods.join(' + ') : (selectedEntry.metadata.paymentMethod || 'Cash');
                        }
                        return selectedEntry.metadata.paymentMethod || 'Cash';
                      })()}
                    </p>
                  </div>

                  {/* Return All Actions */}
                  {!selectedEntry.metadata.reversed && saleItems.some(i => (i.quantity - i.returned_quantity) > 0) && !showReturnAllConfirm && (
                    <button
                      onClick={() => setShowReturnAllConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--warning)', color: '#FFFFFF', padding: '12px' }}
                    >
                      <RotateCcw size={16} />
                      <span className="text-sm">Return All Items</span>
                    </button>
                  )}

                  {/* Inline Return All Confirmation */}
                  {showReturnAllConfirm && (
                    <div className="rounded-xl border" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--background)', padding: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                            <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Return All Items</h4>
                          </div>
                          <button
                            onClick={() => setShowReturnAllConfirm(false)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)' }}
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          This will return all remaining items back to inventory and reduce the sale total to 0. This cannot be undone.
                        </p>

                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowReturnAllConfirm(false)}
                            disabled={returnProcessing}
                            className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleReturnAll}
                            disabled={returnProcessing}
                            className="flex-1 py-2.5 rounded-lg text-sm text-white transition-all flex items-center justify-center gap-2"
                            style={{ backgroundColor: 'var(--danger)', opacity: returnProcessing ? 0.7 : 1 }}
                          >
                            {returnProcessing ? 'Processing...' : 'Return All'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEntry.metadata.reversed && (
                    <div className="rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', padding: '12px', border: '1px solid var(--danger)' }}>
                      <Check size={18} style={{ color: 'var(--danger)' }} />
                      <p className="text-sm" style={{ color: 'var(--danger)' }}>This sale has been fully reversed</p>
                    </div>
                  )}

                  {!selectedEntry.metadata.reversed && saleItems.length > 0 && saleItems.every(i => (i.quantity - i.returned_quantity) <= 0) && (
                    <div className="rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF9C3', padding: '12px', border: '1px solid var(--warning)' }}>
                      <Check size={18} style={{ color: '#854d0e' }} />
                      <p className="text-sm" style={{ color: '#854d0e' }}>All items have been returned</p>
                    </div>
                  )}
                </>
              )}

              {/* Expense Details */}
              {selectedEntry.type === 'expense' && selectedEntry.metadata && (
                <>
                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Amount</p>
                    <p className="text-sm" style={{ color: 'var(--danger)' }}>{Math.round(selectedEntry.metadata.amount)} <span style={{ opacity: 0.7 }}>br</span></p>
                  </div>

                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Category</p>
                    <p className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.category}</p>
                  </div>

                  {selectedEntry.metadata.notes && (
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Notes</p>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* Sale Reversed / Partial Return Details */}
              {selectedEntry.type === 'sale_reversed' && selectedEntry.metadata && (
                <>
                  {selectedEntry.metadata.product_name && (
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Product</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.product_name}</p>
                    </div>
                  )}

                  {selectedEntry.metadata.partial && (
                    <>
                      <div className="flex gap-2">
                        <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Returned</p>
                          <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>{selectedEntry.metadata.returned_quantity} units</p>
                        </div>
                        {selectedEntry.metadata.original_quantity && (
                          <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Original Qty</p>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.original_quantity} units</p>
                          </div>
                        )}
                      </div>

                      {selectedEntry.metadata.unit_price && (
                        <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Unit Price</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.unit_price)} <span style={{ opacity: 0.7 }}>br</span></p>
                        </div>
                      )}

                      <div className="rounded-lg" style={{ backgroundColor: '#FEF2F2', padding: '12px', border: '1px solid var(--danger)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Deduction</p>
                        <p className="text-sm font-bold" style={{ color: 'var(--danger)' }}>-{Math.round(selectedEntry.metadata.deduction)} <span style={{ opacity: 0.7 }}>br</span></p>
                      </div>

                      <div className="flex gap-2">
                        <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Sale Before</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.previous_sale_total)} <span style={{ opacity: 0.7 }}>br</span></p>
                        </div>
                        <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Sale After</p>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.new_sale_total)} <span style={{ opacity: 0.7 }}>br</span></p>
                        </div>
                      </div>

                      {selectedEntry.metadata.payment_adjustment && (
                        <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Adjusted Payments</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {selectedEntry.metadata.payment_adjustment.cash > 0 && (
                              <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--text-secondary)' }}>Cash</span>
                                <span style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.payment_adjustment.cash)} <span style={{ opacity: 0.7 }}>br</span></span>
                              </div>
                            )}
                            {selectedEntry.metadata.payment_adjustment.bank > 0 && (
                              <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--text-secondary)' }}>Bank</span>
                                <span style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.payment_adjustment.bank)} <span style={{ opacity: 0.7 }}>br</span></span>
                              </div>
                            )}
                            {selectedEntry.metadata.payment_adjustment.telebirr > 0 && (
                              <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--text-secondary)' }}>Telebirr</span>
                                <span style={{ color: 'var(--text-primary)' }}>{Math.round(selectedEntry.metadata.payment_adjustment.telebirr)} <span style={{ opacity: 0.7 }}>br</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Stock Adjustment Details */}
              {selectedEntry.type === 'stock_adjustment' && selectedEntry.metadata && (
                <>
                  {selectedEntry.metadata.product_name && (
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Product</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.product_name}</p>
                    </div>
                  )}

                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Adjustment</p>
                    <p className="text-sm" style={{ color: selectedEntry.metadata.amount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {selectedEntry.metadata.amount > 0 ? '+' : ''}{selectedEntry.metadata.amount || selectedEntry.metadata.adjustment} units
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Before</p>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.previous_stock ?? '-'} units</p>
                    </div>
                    <div className="rounded-lg flex-1" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>After</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.new_stock ?? selectedEntry.metadata.newStock} units</p>
                    </div>
                  </div>

                  {selectedEntry.metadata.reason && (
                    <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason</p>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.reason}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Partial Return is now inline in the sale detail card above */}

      {/* Return All confirmation is now inline in the sale detail card above */}
    </div>
  );
}