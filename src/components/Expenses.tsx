import { useEffect, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar, Filter } from 'lucide-react';
import { ExpenseForm } from './ExpenseForm';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  notes: string;
  date: string;
  createdAt: string;
}

type DateFilter = 'today' | '3days' | 'week' | '2weeks' | 'month' | 'year' | 'all';

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Marketing', 'Transport', 'Other'];

export function Expenses() {
  const { currentBranchId } = useBranch();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const EXPENSES_PER_PAGE = 20;

  const fetchExpenses = async (pageNumber = 0, currentDateFilter = dateFilter, currentCategoryFilter = categoryFilter) => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('menal_expenses')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
        .order('date', { ascending: false });

      // Apply filters
      if (currentCategoryFilter !== 'all') {
        query = query.eq('category', currentCategoryFilter);
      }

      const now = new Date();
      if (currentDateFilter === 'today') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        query = query.gte('date', startOfDay);
      } else if (currentDateFilter === '3days') {
        const threeDaysAgo = new Date(now.setDate(now.getDate() - 3)).toISOString();
        query = query.gte('date', threeDaysAgo);
      } else if (currentDateFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
        query = query.gte('date', weekAgo);
      } else if (currentDateFilter === '2weeks') {
        const twoWeeksAgo = new Date(now.setDate(now.getDate() - 14)).toISOString();
        query = query.gte('date', twoWeeksAgo);
      } else if (currentDateFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        query = query.gte('date', monthAgo);
      } else if (currentDateFilter === 'year') {
        const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        query = query.gte('date', yearAgo);
      }

      // Pagination
      const from = pageNumber * EXPENSES_PER_PAGE;
      const to = from + EXPENSES_PER_PAGE - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      // Map database columns to component interface
      const mappedExpenses = (data || []).map(e => ({
        id: e.id,
        name: e.name,
        category: e.category,
        amount: e.amount,
        notes: e.notes || '',
        date: e.date,
        createdAt: e.created_at,
      }));

      if (mappedExpenses.length < EXPENSES_PER_PAGE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      // If page is 0, replace; otherwise append? 
      // User style seems to be "Next/Prev" page replacement, not infinite scroll.
      // So we replace.
      setExpenses(mappedExpenses);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Expenses fetch error:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchExpenses(0, dateFilter, categoryFilter);
  }, [currentBranchId, dateFilter, categoryFilter]);

  const handleNextPage = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchExpenses(nextPage, dateFilter, categoryFilter);
  };

  const handlePrevPage = () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    fetchExpenses(prevPage, dateFilter, categoryFilter);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get expense details before deletion
      const { data: expense } = await supabase
        .from('menal_expenses')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('menal_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log deletion activity
      await supabase.from('menal_activity_log').insert({
        id: generateId(),
        type: 'expense_deleted',
        expense_id: id,
        branch_id: currentBranchId,
        details: `Expense deleted: ${expense?.name || 'Unknown'}`,
        metadata: expense,
      });

      toast.success('Expense deleted successfully!');
      fetchExpenses();
    } catch (error) {
      console.error('Delete expense error:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    fetchExpenses();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredExpenses = expenses;
  // Previously we filtered client-side, now we use server-side pagination/filtering
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseCount = filteredExpenses.length;

  // Group by date
  const groupedExpenses = filteredExpenses.reduce((groups: { [key: string]: Expense[] }, expense) => {
    const date = formatDate(expense.date);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {});

  const dateFilterLabels: Record<DateFilter, string> = {
    today: 'Today',
    '3days': '3 Days',
    week: 'Week',
    '2weeks': '2 Weeks',
    month: 'Month',
    year: 'Year',
    all: 'All Time'
  };

  if (loading) {
    return <LoadingSpinner message="Loading expenses..." />;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Expenses</h2>

        {/* Floating Add Button */}
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: 'var(--danger)',
            color: '#FFFFFF',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
            border: 'none',
            cursor: 'pointer'
          }}
          aria-label="Add Expense"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Date Filter - Compact Scrollable Row */}
      <div style={{ marginBottom: '16px' }}>
        <div
          className="flex gap-2 pb-2"
          style={{
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
          {(Object.keys(dateFilterLabels) as DateFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className="px-4 py-2 rounded-lg whitespace-nowrap transition-all text-xs"
              style={{
                backgroundColor: dateFilter === filter ? 'var(--primary)' : 'var(--gray-light)',
                color: dateFilter === filter ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${dateFilter === filter ? 'var(--primary)' : 'var(--border)'}`,
                fontWeight: dateFilter === filter ? 600 : 400
              }}
            >
              {dateFilterLabels[filter]}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter - Compact Chips */}
      <div style={{ marginBottom: '20px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Category</p>
        </div>
        <div
          className="flex gap-2 pb-2"
          style={{
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <button
            onClick={() => setCategoryFilter('all')}
            className="px-3 py-1.5 rounded-full whitespace-nowrap transition-all text-xs"
            style={{
              backgroundColor: categoryFilter === 'all' ? 'var(--secondary)' : 'var(--gray-light)',
              color: categoryFilter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              border: `1px solid ${categoryFilter === 'all' ? 'var(--secondary)' : 'var(--border)'}`,
              fontWeight: categoryFilter === 'all' ? 600 : 400
            }}
          >
            All
          </button>
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1.5 rounded-full whitespace-nowrap transition-all text-xs"
              style={{
                backgroundColor: categoryFilter === cat ? 'var(--secondary)' : 'var(--gray-light)',
                color: categoryFilter === cat ? 'var(--primary)' : 'var(--text-secondary)',
                border: `1px solid ${categoryFilter === cat ? 'var(--secondary)' : 'var(--border)'}`,
                fontWeight: categoryFilter === cat ? 600 : 400
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div
          className="rounded-xl shadow-sm border"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '14px' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Total Expenses</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
            {totalExpenses.toFixed(2)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
          </p>
        </div>
        <div
          className="rounded-xl shadow-sm border"
          style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '14px' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>Count</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
            {expenseCount} <span className="text-xs" style={{ opacity: 0.7 }}>items</span>
          </p>
        </div>
      </div>

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center rounded-2xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '48px 24px' }}>
          <DollarSign size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-primary)' }}>No expenses found</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {expenses.length === 0 ? 'Start tracking your expenses' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(groupedExpenses).map(([date, dateExpenses]) => (
            <div key={date}>
              <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
                <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{date}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dateExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="rounded-xl shadow-sm border"
                    style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '14px' }}
                  >
                    <div className="flex items-start justify-between" style={{ marginBottom: '10px' }}>
                      <div className="flex-1">
                        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>{expense.name}</p>
                        <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {expense.category}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ backgroundColor: 'var(--gray-light)', color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="rounded-lg" style={{ backgroundColor: 'var(--gray-light)', padding: '10px', marginBottom: expense.notes ? '8px' : '0' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>
                        {expense.amount.toFixed(2)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
                      </p>
                    </div>

                    {expense.notes && (
                      <p className="text-xs rounded-lg" style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)', padding: '10px' }}>
                        {expense.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {Math.min(totalCount, page * EXPENSES_PER_PAGE + 1)}-{Math.min((page + 1) * EXPENSES_PER_PAGE, totalCount)} of {totalCount}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={handlePrevPage}
            disabled={page === 0 || loading}
            className="pagination-btn"
          >
            Previous
          </button>

          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Page {page + 1} of {Math.ceil(totalCount / EXPENSES_PER_PAGE) || 1}
          </span>

          <button
            onClick={handleNextPage}
            disabled={!hasMore || loading}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <ExpenseForm onClose={handleFormClose} />
      )}
    </div>
  );
}