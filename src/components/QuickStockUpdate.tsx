import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import { toast } from 'sonner';
import { ArrowLeft, Save, Search, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  barcode: string | null;
}

export function QuickStockUpdate({ onBack }: { onBack: () => void }) {
  const { currentBranchId } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track changes: { productId: newStockValue }
  const [draftChanges, setDraftChanges] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentBranchId) {
      fetchProducts();
    }
  }, [currentBranchId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menal_products')
        .select('id, name, category, stock, barcode')
        .eq('branch_id', currentBranchId)
        .not('name', 'like', '[Category Placeholder]%')
        .order('barcode', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setProducts(data || []);
      setDraftChanges({}); // clear drafts on fresh load
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setDraftChanges(prev => ({ ...prev, [id]: numValue }));
    } else if (value === '') {
      // allow empty temporarily
      setDraftChanges(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(draftChanges);
    if (updates.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Supabase doesn't have a simple bulk update for different rows with different values out of the box in the JS client
      // So we will do it sequentially or use Promise.all for a batch
      const promises = updates.map(([id, newStock]) => {
        // Find the original product to log activity
        const product = products.find(p => p.id === id);
        if (!product) return Promise.resolve();

        const oldStock = product.stock;
        
        // Return a promise that updates stock AND logs the activity
        return (async () => {
          const { error: updateError } = await supabase
            .from('menal_products')
            .update({ stock: newStock })
            .eq('id', id);
            
          if (updateError) throw updateError;
          
          // Log the adjustment
          const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await supabase.from('menal_activity_log').insert({
            id: logId,
            branch_id: currentBranchId,
            type: 'stock_adjusted',
            details: `Stock updated for "${product.name}" via Quick Update. Original: ${oldStock}, New: ${newStock}`,
            metadata: { 
              productId: id, 
              productName: product.name, 
              oldStock, 
              newStock,
              adjustmentType: 'quick_spreadsheet_update'
            },
          });
        })();
      });

      await Promise.all(promises);

      toast.success(`Successfully updated ${updates.length} products!`);
      // Refresh the list to get true state from DB and clear drafts
      fetchProducts();
    } catch (err) {
      console.error('Error saving updates:', err);
      toast.error('Some updates failed. Please refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
  });

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={24} style={{ color: 'var(--primary)' }} />
            <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Quick Stock Update</h2>
          </div>
        </div>
        
        <button
          onClick={handleSaveAll}
          disabled={saving || Object.keys(draftChanges).length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: Object.keys(draftChanges).length > 0 ? 'var(--primary)' : 'var(--gray-light)',
            color: Object.keys(draftChanges).length > 0 ? '#FFFFFF' : 'var(--text-secondary)',
            opacity: saving ? 0.7 : 1,
            cursor: saving || Object.keys(draftChanges).length === 0 ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          <Save size={18} />
          {saving ? 'Saving...' : `Save Changes (${Object.keys(draftChanges).length})`}
        </button>
      </div>

      <div className="rounded-2xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '20px', marginBottom: '20px' }}>
        <div className="flex items-center gap-3">
          <Search size={20} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg border-none outline-none"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            Loading products...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: 'var(--gray-light)', borderBottom: '1px solid var(--border)' }}>
                  <th className="p-3 font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Barcode</th>
                  <th className="p-3 font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Product Name</th>
                  <th className="p-3 font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>Category</th>
                  <th className="p-3 font-semibold text-sm text-right" style={{ color: 'var(--text-secondary)' }}>Current Stock</th>
                  <th className="p-3 font-semibold text-sm text-right" style={{ color: 'var(--text-secondary)', width: '150px' }}>New Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product, index) => {
                    const isEdited = draftChanges[product.id] !== undefined && draftChanges[product.id] !== product.stock;
                    const displayValue = draftChanges[product.id] !== undefined ? draftChanges[product.id] : product.stock;
                    
                    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        const nextInput = document.getElementById(`stock-input-${index + 1}`);
                        if (nextInput) {
                          (nextInput as HTMLInputElement).focus();
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevInput = document.getElementById(`stock-input-${index - 1}`);
                        if (prevInput) {
                          (prevInput as HTMLInputElement).focus();
                        }
                      }
                    };

                    return (
                      <tr key={product.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: isEdited ? '#FEF3C7' : 'transparent' }}>
                        <td className="p-3 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {product.barcode || '-'}
                        </td>
                        <td className="p-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {product.name}
                        </td>
                        <td className="p-3 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {product.category}
                        </td>
                        <td className="p-3 text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                          {product.stock}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            id={`stock-input-${index}`}
                            type="number"
                            min="0"
                            value={displayValue}
                            onChange={(e) => handleStockChange(product.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={handleKeyDown}
                            className="w-full text-right px-2 py-1.5 rounded border outline-none font-medium"
                            style={{ 
                              backgroundColor: isEdited ? '#FFF' : 'var(--gray-light)', 
                              borderColor: isEdited ? 'var(--primary)' : 'transparent',
                              color: 'var(--text-primary)'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
