import { useEffect, useState } from 'react';
import { Package, ShoppingCart, DollarSign, TrendingUp, TrendingDown, RotateCcw, X, Check } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

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

export function HistoryView() {
  const { currentBranchId } = useBranch();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  const fetchHistory = async (pageNumber: number, reset = false) => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('menal_activity_log')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
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
  }, [currentBranchId]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, false);
  };

  const handleReverseSale = async (saleId: string) => {
    if (!confirm('Are you sure you want to reverse this sale? Products will be returned to inventory.')) return;

    try {
      // Use RPC function to reverse the sale (handles stock restoration and sale update)
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
          {/* Horizontal Scrolling Filter Chips */}
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
                    {entry.metadata?.amount && (
                      <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                        {Math.round(entry.metadata.amount || 0)} <span style={{ opacity: 0.7 }}>br</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => setSelectedEntry(null)}>
          <div
            className="w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--background)' }}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedEntry.metadata.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span style={{ color: 'var(--text-primary)' }}>
                            {item.productName} x{item.quantity}
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>
                            {Math.round(item.total)} <span style={{ opacity: 0.7 }}>br</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

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
                          const methods = [];
                          if (details.cash > 0) methods.push(`Cash(${Math.round(details.cash)})`);
                          if (details.bank > 0) methods.push(`Bank(${Math.round(details.bank)})`);
                          if (details.telebirr > 0) methods.push(`Telebirr(${Math.round(details.telebirr)})`);
                          return methods.length > 0 ? methods.join(' + ') : (selectedEntry.metadata.paymentMethod || 'Cash');
                        }
                        return selectedEntry.metadata.paymentMethod || 'Cash';
                      })()}
                    </p>
                  </div>

                  {!selectedEntry.metadata.reversed && (
                    <button
                      onClick={() => handleReverseSale(selectedEntry.saleId!)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                      style={{ backgroundColor: 'var(--warning)', color: '#FFFFFF', padding: '12px' }}
                    >
                      <RotateCcw size={16} />
                      <span className="text-sm">Reverse Sale</span>
                    </button>
                  )}

                  {selectedEntry.metadata.reversed && (
                    <div className="rounded-lg flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', padding: '12px', border: '1px solid var(--danger)' }}>
                      <Check size={18} style={{ color: 'var(--danger)' }} />
                      <p className="text-sm" style={{ color: 'var(--danger)' }}>This sale has been reversed</p>
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

              {/* Stock Adjustment Details */}
              {selectedEntry.type === 'stock_adjustment' && selectedEntry.metadata && (
                <>
                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Adjustment</p>
                    <p className="text-sm" style={{ color: selectedEntry.metadata.adjustment > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {selectedEntry.metadata.adjustment > 0 ? '+' : ''}{selectedEntry.metadata.adjustment} units
                    </p>
                  </div>

                  <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '12px' }}>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>New Stock</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedEntry.metadata.newStock} units</p>
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
    </div>
  );
}