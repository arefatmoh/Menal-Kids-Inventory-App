import { useState } from 'react';
import { X, PlusCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';

interface Product {
  id: string;
  name: string;
  stock: number;
  adjustmentType?: 'add' | 'remove';
}

interface StockAdjustmentProps {
  product: Product;
  onClose: () => void;
}

export function StockAdjustment({ product, onClose }: StockAdjustmentProps) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdding = product.adjustmentType === 'add';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setLoading(true);

    try {
      const adjustment = isAdding ? parseInt(quantity) : -parseInt(quantity);
      const reasonText = reason || (isAdding ? 'Stock added' : 'Stock removed');

      // Use RPC function to adjust stock and log the activity
      const { error } = await supabase
        .rpc('menal_adjust_product_stock', {
          product_id: product.id,
          adjustment_amount: adjustment,
          adjustment_reason: reasonText,
        });

      if (error) throw error;

      toast.success(`Stock ${isAdding ? 'added' : 'removed'} successfully!`);
      onClose();
    } catch (error) {
      console.error('Adjust stock error:', error);
      toast.error('Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{
          backgroundColor: 'var(--background)',
          margin: '0 16px'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b"
          style={{
            borderColor: 'var(--border)',
            padding: '20px 24px'
          }}
        >
          <div className="flex items-center gap-3">
            {isAdding ? (
              <PlusCircle size={24} style={{ color: 'var(--success)' }} />
            ) : (
              <MinusCircle size={24} style={{ color: 'var(--danger)' }} />
            )}
            <h3 style={{ color: 'var(--text-primary)' }}>
              {isAdding ? 'Add Stock' : 'Remove Stock'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--gray-light)',
              color: 'var(--text-primary)',
              padding: '8px',
              border: 'none'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Product Info Card */}
            <div
              className="rounded-xl"
              style={{
                backgroundColor: 'var(--secondary)',
                opacity: 0.3,
                padding: '16px'
              }}
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Product
              </p>
              <p style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                {product.name}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Current Stock: {product.stock} units
              </p>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                Quantity *
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                min="1"
                className="w-full rounded-xl border"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)',
                  padding: '12px 16px',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isAdding ? 'e.g., New shipment' : 'e.g., Damaged items'}
                className="w-full rounded-xl border"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)',
                  padding: '12px 16px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* New Stock Preview */}
            {quantity && parseInt(quantity) > 0 && (
              <div
                className="rounded-xl"
                style={{
                  backgroundColor: isAdding ? '#E8F5E9' : '#FFEBEE',
                  padding: '16px'
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  New Stock: {isAdding ? product.stock + parseInt(quantity) : product.stock - parseInt(quantity)} units
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  padding: '12px',
                  border: 'none'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: isAdding ? 'var(--success)' : 'var(--danger)',
                  color: '#FFFFFF',
                  padding: '12px',
                  border: 'none'
                }}
              >
                {loading ? 'Saving...' : isAdding ? 'Add Stock' : 'Remove Stock'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}