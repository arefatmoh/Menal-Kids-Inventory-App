import { useState } from 'react';
import { X, DollarSign, Tag, Calendar, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

interface ExpenseFormProps {
  onClose: () => void;
}

export function ExpenseForm({ onClose }: ExpenseFormProps) {
  const { currentBranchId } = useBranch();
  const [formData, setFormData] = useState({
    name: '',
    category: 'Utilities',
    amount: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  const categories = ['Utilities', 'Rent', 'Supplies', 'Transportation', 'Marketing', 'Salary', 'Other'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expenseId = generateId();

      const { error } = await supabase
        .from('menal_expenses')
        .insert({
          id: expenseId,
          name: formData.name,
          category: formData.category,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
          date: new Date(formData.date).toISOString(),
          branch_id: currentBranchId,
        });

      if (error) throw error;

      // Log expense activity
      await supabase.from('menal_activity_log').insert({
        id: generateId(),
        type: 'expense',
        expense_id: expenseId,
        branch_id: currentBranchId,
        details: `Expense: ${formData.name} - ${parseFloat(formData.amount)} br`,
        metadata: {
          name: formData.name,
          category: formData.category,
          amount: parseFloat(formData.amount),
          notes: formData.notes
        },
      });

      toast.success('Expense added successfully! 💰');
      onClose();
    } catch (error) {
      console.error('Save expense error:', error);
      toast.error('Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl"
        style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b"
          style={{
            borderColor: 'var(--border)',
            padding: '24px',
            flexShrink: 0
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: '#FEE2E2'
              }}
            >
              <Receipt size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '2px' }}>
                Add New Expense
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Track your business expenses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all hover:bg-opacity-80"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Expense Name */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <Receipt size={16} style={{ color: 'var(--danger)' }} />
                Expense Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Electricity Bill"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)'
                }}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <Tag size={16} style={{ color: 'var(--danger)' }} />
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)'
                }}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount & Date - Two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                  <DollarSign size={16} style={{ color: 'var(--danger)' }} />
                  Amount (br) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--gray-light)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border)'
                  }}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                  <Calendar size={16} style={{ color: 'var(--danger)' }} />
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--gray-light)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border)'
                  }}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <FileText size={16} style={{ color: 'var(--danger)' }} />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional details..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border outline-none resize-none transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)'
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#FFFFFF',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
              }}
            >
              {loading ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}