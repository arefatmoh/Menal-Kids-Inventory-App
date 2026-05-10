import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Printer, Plus, Save, CheckCircle, Clock, AlertTriangle, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import { fetchCategories } from '../utils/categories';
import { LoadingSpinner } from './LoadingSpinner';

interface StockAudit {
  id: string;
  branch_id: string;
  name: string;
  status: 'draft' | 'completed';
  category_filter: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface StockAuditItem {
  id: string;
  audit_id: string;
  product_id: string;
  system_stock: number;
  actual_stock: number | null;
  difference: number | null;
  product_name?: string;
  product_barcode?: string;
  product_category?: string;
}

export function StockAudits() {
  const { currentBranchId } = useBranch();
  const [view, setView] = useState<'audit' | 'history' | 'historical_audit'>('audit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  
  // Active audit state
  const [currentAudit, setCurrentAudit] = useState<StockAudit | null>(null);
  const [auditItems, setAuditItems] = useState<StockAuditItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showUncountedConfirm, setShowUncountedConfirm] = useState(false);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [showSyncCompletedConfirm, setShowSyncCompletedConfirm] = useState(false);

  useEffect(() => {
    if (currentBranchId) {
      if (view === 'audit') {
        loadCategories();
        loadActiveOrCreateAudit();
      } else if (view === 'history') {
        loadAudits();
      }
    }
  }, [view, currentBranchId]);

  const loadCategories = async () => {
    if (!currentBranchId) return;
    try {
      const cats = await fetchCategories(currentBranchId);
      setCategories(['all', ...cats]);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const loadAudits = async () => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menal_stock_audits')
        .select('*')
        .eq('branch_id', currentBranchId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          toast.error('Audit tables not created. Please run the SQL script first.');
        } else throw error;
      } else {
        setAudits(data || []);
      }
    } catch (err) {
      console.error('Error loading audits:', err);
      toast.error('Failed to load audits');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveOrCreateAudit = async () => {
    setLoading(true);
    try {
      const { data: drafts, error } = await supabase
        .from('menal_stock_audits')
        .select('id')
        .eq('branch_id', currentBranchId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (drafts && drafts.length > 0) {
        await loadAuditItems(drafts[0].id);
      } else {
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        await startAuditSilently(`Stock Audit - ${today}`);
      }
    } catch (err) {
      console.error('Failed to load or create active audit:', err);
      toast.error('Failed to prepare active audit');
      setLoading(false);
    }
  };

  const startAuditSilently = async (name: string) => {
    if (!currentBranchId) return;
    
    const { data: products, error: productsError } = await supabase
      .from('menal_products')
      .select('id, stock')
      .eq('branch_id', currentBranchId);
      
    if (productsError) throw productsError;

    const { data: auditData, error: auditError } = await supabase
      .from('menal_stock_audits')
      .insert([{
        branch_id: currentBranchId,
        name: name,
        category_filter: null,
      }])
      .select()
      .single();

    if (auditError) throw auditError;

    if (products && products.length > 0) {
      const auditItemsToInsert = products.map((p) => ({
        audit_id: auditData.id,
        product_id: p.id,
        system_stock: p.stock,
      }));

      const { error: itemsError } = await supabase
        .from('menal_stock_audit_items')
        .insert(auditItemsToInsert);

      if (itemsError) throw itemsError;
    }

    await loadAuditItems(auditData.id);
  };

  const loadAuditItems = async (auditId: string) => {
    setLoading(true);
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('menal_stock_audits')
        .select('*')
        .eq('id', auditId)
        .single();
        
      if (auditError) throw auditError;
      setCurrentAudit(auditData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('menal_stock_audit_items')
        .select(`
          *,
          menal_products (
            name,
            barcode,
            category
          )
        `)
        .eq('audit_id', auditId);

      if (itemsError) throw itemsError;

      const formattedItems = (itemsData || []).map((item: any) => ({
        ...item,
        product_name: item.menal_products?.name || 'Unknown Product',
        product_barcode: item.menal_products?.barcode || '',
        product_category: item.menal_products?.category || 'Uncategorized',
      }));

      formattedItems.sort((a: any, b: any) => {
        const barcodeA = String(a.product_barcode || '');
        const barcodeB = String(b.product_barcode || '');
        if (barcodeA && barcodeB) {
          return barcodeA.localeCompare(barcodeB);
        }
        if (barcodeA) return -1;
        if (barcodeB) return 1;
        
        const nameA = String(a.product_name || '');
        const nameB = String(b.product_name || '');
        return nameA.localeCompare(nameB);
      });
      setAuditItems(formattedItems);
    } catch (err) {
      console.error('Error loading audit details:', err);
      toast.error('Failed to load audit items');
    } finally {
      setLoading(false);
    }
  };

  const executeDeleteAudit = async () => {
    if (!deleteConfirmId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('menal_stock_audits')
        .delete()
        .eq('id', deleteConfirmId);
        
      if (error) throw error;
      toast.success('Audit deleted successfully');
      
      if ((view === 'audit' || view === 'historical_audit') && currentAudit?.id === deleteConfirmId) {
        if (view === 'historical_audit') {
          setView('history');
        } else {
          await loadActiveOrCreateAudit();
        }
      } else {
        setAudits(audits.filter(a => a.id !== deleteConfirmId));
      }
    } catch (err) {
      console.error('Error deleting audit:', err);
      toast.error('Failed to delete audit');
    } finally {
      setSaving(false);
      setDeleteConfirmId(null);
    }
  };

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateStock = (itemId: string, newValue: string) => {
    const value = newValue.trim() === '' ? null : parseInt(newValue, 10);
    
    setAuditItems((prev) => prev.map(item => {
      if (item.id === itemId) {
        const difference = value !== null ? value - item.system_stock : null;
        const updatedItem = { ...item, actual_stock: value, difference };
        
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
          saveItemToDb(itemId, value, difference);
        }, 500);

        return updatedItem;
      }
      return item;
    }));
  };

  const saveItemToDb = async (itemId: string, actual_stock: number | null, difference: number | null) => {
    try {
      await supabase
        .from('menal_stock_audit_items')
        .update({ actual_stock, difference })
        .eq('id', itemId);
    } catch (err) {
      console.error('Auto-save failed', err);
    }
  };

  const initiateCompleteAudit = () => {
    if (!currentAudit) return;
    const uncounted = auditItems.filter(i => i.actual_stock === null).length;
    if (uncounted > 0) {
      setShowUncountedConfirm(true);
    } else {
      setShowSyncOptions(true);
    }
  };

  const executeCompleteAudit = async (shouldUpdateStock: boolean) => {
    if (!currentAudit) return;
    setShowSyncOptions(false);
    setSaving(true);
    try {
      if (shouldUpdateStock) {
        const updates = auditItems
          .filter(i => i.actual_stock !== null && i.difference !== 0)
          .map(i => ({
            id: i.product_id,
            stock: i.actual_stock!,
            system_stock: i.system_stock,
            product_name: i.product_name || 'Unknown Product',
            difference: i.difference!
          }));

        for (const update of updates) {
          await supabase
            .from('menal_products')
            .update({ stock: update.stock, updated_at: new Date().toISOString() })
            .eq('id', update.id);
            
          const direction = update.difference > 0 ? 'increased' : 'decreased';
          await supabase
            .from('menal_activity_log')
            .insert([{
              id: crypto.randomUUID(),
              branch_id: currentBranchId,
              type: 'stock_adjustment',
              details: `Stock ${direction} by ${Math.abs(update.difference)}. Reason: Audit sync`,
              product_id: update.id,
              metadata: {
                product_id: update.id,
                product_name: update.product_name,
                amount: update.difference,
                reason: 'Audit sync',
                previous_stock: update.system_stock,
                new_stock: update.stock
              }
            }]);
        }
      }

      // Mark completed
      const { error } = await supabase
        .from('menal_stock_audits')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', currentAudit.id);

      if (error) throw error;

      toast.success(shouldUpdateStock ? 'Audit completed and inventory updated!' : 'Audit completed (inventory unchanged)');
      setView('history');
    } catch (err) {
      console.error('Error completing audit:', err);
      toast.error('Failed to complete audit');
    } finally {
      setSaving(false);
    }
  };

  const executeSyncCompletedAudit = async () => {
    if (!currentAudit) return;
    setShowSyncCompletedConfirm(false);
    setSaving(true);
    try {
      const updates = auditItems
        .filter(i => i.actual_stock !== null && i.difference !== 0)
        .map(i => ({
          id: i.product_id,
          stock: i.actual_stock!,
          system_stock: i.system_stock,
          product_name: i.product_name || 'Unknown Product',
          difference: i.difference!
        }));

      for (const update of updates) {
        await supabase
          .from('menal_products')
          .update({ stock: update.stock, updated_at: new Date().toISOString() })
          .eq('id', update.id);
          
        const direction = update.difference > 0 ? 'increased' : 'decreased';
        await supabase
          .from('menal_activity_log')
          .insert([{
            id: crypto.randomUUID(),
            branch_id: currentBranchId,
            type: 'stock_adjustment',
            details: `Stock ${direction} by ${Math.abs(update.difference)}. Reason: Audit sync`,
            product_id: update.id,
            metadata: {
              product_id: update.id,
              product_name: update.product_name,
              amount: update.difference,
              reason: 'Audit sync',
              previous_stock: update.system_stock,
              new_stock: update.stock
            }
          }]);
      }
      toast.success(`Inventory successfully updated for ${updates.length} items!`);
      setView('history');
    } catch (err) {
      console.error('Error syncing:', err);
      toast.error('Failed to sync inventory');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintCountingSheet = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups.');
      return;
    }

    const rows = auditItems.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_name}</td>
        <td style="font-family:monospace;text-align:center">${p.product_barcode || ''}</td>
        <td style="text-align:center">${p.system_stock}</td>
        <td style="text-align:center">${p.actual_stock !== null ? p.actual_stock : ''}</td>
        <td style="text-align:center">${p.difference !== null ? (p.difference > 0 ? '+' : '') + p.difference : ''}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Counting Sheet - ${currentAudit?.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 10px; }
          h2 { text-align: center; margin-bottom: 4px; font-size: 18px; color: #333; }
          .subtitle { text-align: center; font-size: 12px; color: #888; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th { background: #f0f0f0; color: #333; padding: 10px; text-align: left; font-weight: 600; border: 1px solid #ccc; }
          th:nth-child(1) { width: 40px; text-align: center; }
          th:nth-child(3) { text-align: center; width: 100px; }
          th:nth-child(4) { text-align: center; width: 80px; }
          th:nth-child(5) { text-align: center; width: 80px; }
          th:nth-child(6) { text-align: center; width: 80px; }
          td { padding: 10px; border: 1px solid #ccc; }
          td:first-child { text-align: center; color: #666; }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
          .no-print { text-align: center; padding: 16px; background: #f5f5f5; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
          .no-print button { padding: 10px 24px; background: #714329; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Counting Sheet</button>
        </div>
        <h2>Stock Counting Sheet</h2>
        <div class="subtitle">${currentAudit?.name} &bull; ${auditItems.length} items</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>Barcode</th>
              <th>System</th>
              <th>Actual</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredItems = auditItems.filter(item => {
    if (selectedCategory !== 'all' && item.product_category !== selectedCategory) {
      return false;
    }
    const name = String(item.product_name || '').toLowerCase();
    const barcode = String(item.product_barcode || '');
    const query = searchQuery.toLowerCase();
    return name.includes(query) || barcode.includes(query);
  });

  return (
    <div style={{ backgroundColor: 'var(--background)', minHeight: '100%', paddingBottom: '20px' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          backgroundColor: 'var(--background)',
          borderBottom: '1px solid var(--border)',
          padding: '16px var(--container-padding)',
        }}
      >
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            {view === 'historical_audit' && (
              <button onClick={() => setView('history')} className="p-2 -ml-2 rounded-lg transition-colors hover:bg-black/5">
                <ArrowLeft size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            )}
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {view === 'history' ? 'Audit History' : view === 'historical_audit' ? currentAudit?.name : 'Active Audit'}
            </h1>
          </div>
          
          <div className="flex gap-2">
            {(view === 'audit' || view === 'historical_audit') && (
              <button
                onClick={() => setView('history')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all active:scale-95 text-sm border"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              >
                <Clock size={16} />
                <span className="hidden sm:inline">History</span>
              </button>
            )}
            
            {view === 'history' && (
              <button
                onClick={() => setView('audit')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-95 text-sm"
                style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none' }}
              >
                <Plus size={16} />
                Active Audit
              </button>
            )}

            {((view === 'audit' && currentAudit?.status === 'draft') || (view === 'historical_audit')) && (
              <button
                onClick={handlePrintCountingSheet}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all active:scale-95 text-sm border"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
              >
                <Printer size={16} />
                <span className="hidden sm:inline">Print Sheet</span>
              </button>
            )}

            {view === 'audit' && currentAudit?.status === 'draft' && (
              <button
                onClick={initiateCompleteAudit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-95 text-sm"
                style={{ backgroundColor: 'var(--success)', color: '#FFFFFF', border: 'none', opacity: saving ? 0.7 : 1 }}
              >
                <CheckCircle size={16} />
                Complete Audit
              </button>
            )}

            {view === 'historical_audit' && currentAudit?.status === 'completed' && (
              <button
                onClick={() => setShowSyncCompletedConfirm(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-95 text-sm"
                style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', opacity: saving ? 0.7 : 1 }}
              >
                <Save size={16} />
                Sync Inventory
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {loading ? (
          <LoadingSpinner message="Loading..." />
        ) : view === 'history' ? (
          // History View
          <div className="grid gap-4 md:grid-cols-2">
            {audits.length === 0 ? (
              <div className="col-span-full text-center py-12 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--gray-light)' }}>
                <Clock size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No Audits Found</h3>
                <p style={{ color: 'var(--text-secondary)' }}>You haven't completed any stock audits yet.</p>
              </div>
            ) : (
              audits.map(audit => (
                <div 
                  key={audit.id}
                  onClick={() => {
                    loadAuditItems(audit.id);
                    setView('historical_audit');
                  }}
                  className="p-5 sm:p-6 rounded-2xl shadow-sm border cursor-pointer transition-all hover:shadow-md"
                  style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{audit.name}</h3>
                    <div className="flex items-center gap-3">
                      <span 
                        className="text-xs px-2.5 py-1.5 rounded-full font-medium"
                        style={{
                          backgroundColor: audit.status === 'completed' ? '#dcfce7' : '#fef9c3',
                          color: audit.status === 'completed' ? '#166534' : '#854d0e',
                        }}
                      >
                        {audit.status.toUpperCase()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(audit.id);
                        }}
                        className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-5 pt-4 border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    <span>Created: {new Date(audit.created_at).toLocaleDateString()}</span>
                    {audit.completed_at && <span>Completed: {new Date(audit.completed_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Active/Historical Audit View
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--gray-light)' }}>
                <Search size={18} style={{ color: 'var(--text-secondary)', marginLeft: '8px' }} />
                <input
                  type="text"
                  placeholder="Search products or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm p-2"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>

              {currentAudit?.id && (
                <button
                  onClick={() => setDeleteConfirmId(currentAudit.id)}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all active:scale-95 text-sm"
                  style={{ backgroundColor: 'var(--danger)', color: '#FFFFFF', border: 'none', opacity: saving ? 0.7 : 1 }}
                >
                  <Trash2 size={16} />
                  Delete Audit
                </button>
              )}
            </div>

            {/* Horizontal Category Filter */}
            <div
              className="flex gap-2 mb-4"
              style={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <style>{`div::-webkit-scrollbar { display: none; }`}</style>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-4 py-2 rounded-lg transition-all capitalize text-xs whitespace-nowrap flex-shrink-0"
                  style={{
                    backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--gray-light)',
                    color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-primary)',
                    border: `1px solid ${selectedCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  {cat === 'all' ? 'All Products' : cat}
                </button>
              ))}
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--gray-light)', borderBottom: '1px solid var(--border)' }}>
                      <th className="p-3 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Product</th>
                      <th className="p-3 text-sm font-semibold text-center" style={{ color: 'var(--text-secondary)' }}>System</th>
                      <th className="p-3 text-sm font-semibold text-center" style={{ color: 'var(--text-secondary)' }}>Actual</th>
                      <th className="p-3 text-sm font-semibold text-center" style={{ color: 'var(--text-secondary)' }}>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="p-3">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.product_name}</div>
                          {item.product_barcode && (
                            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.product_barcode}</div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.system_stock}</span>
                        </td>
                        <td className="p-3 text-center">
                          {currentAudit?.status === 'draft' ? (
                            <input
                              type="number"
                              value={item.actual_stock ?? ''}
                              onChange={(e) => handleUpdateStock(item.id, e.target.value)}
                              className="w-20 text-center p-1.5 border rounded-lg outline-none mx-auto block text-sm"
                              style={{ 
                                borderColor: 'var(--border)', 
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-primary)' 
                              }}
                            />
                          ) : (
                            <span className="text-sm font-medium">{item.actual_stock ?? '-'}</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.difference !== null && (
                            <span 
                              className="text-sm font-medium"
                              style={{ 
                                color: item.difference > 0 ? 'var(--success)' : item.difference < 0 ? 'var(--danger)' : 'var(--text-secondary)' 
                              }}
                            >
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                          No products found matching your search and category filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {currentAudit?.status === 'draft' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                <Save size={14} /> Auto-saving drafts
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--background)' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Delete Audit</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this audit? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAudit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm text-white transition-all flex justify-center items-center"
                style={{ backgroundColor: 'var(--danger)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <LoadingSpinner message="" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUncountedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--background)' }}>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle size={24} style={{ color: 'var(--warning)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Uncounted Items</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              There are {auditItems.filter(i => i.actual_stock === null).length} uncounted items. Are you sure you want to proceed to completion?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUncountedConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowUncountedConfirm(false);
                  setShowSyncOptions(true);
                }}
                className="flex-1 py-2.5 rounded-lg text-sm text-white transition-all"
                style={{ backgroundColor: 'var(--warning)' }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showSyncOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Complete Audit</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Do you want to automatically update your main inventory to match your physical count?
              </p>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <button
                onClick={() => executeCompleteAudit(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border transition-all hover:bg-black/5"
                style={{ borderColor: 'var(--success)', backgroundColor: 'var(--gray-light)' }}
              >
                <div className="font-bold text-sm mb-1" style={{ color: 'var(--success)' }}>Yes, Update Inventory</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your product stock levels will be overwritten to match the new physical counts.</div>
              </button>
              
              <button
                onClick={() => executeCompleteAudit(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border transition-all hover:bg-black/5"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <div className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>No, Just Save Report</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>The audit will be saved for your records, but your live inventory will not change.</div>
              </button>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowSyncOptions(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSyncCompletedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--background)' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Sync to Inventory</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to update your live inventory with this audit's counts? Only items with entered physical counts will be modified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncCompletedConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm transition-all"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={executeSyncCompletedAudit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-sm text-white transition-all flex justify-center items-center"
                style={{ backgroundColor: 'var(--primary)', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? <LoadingSpinner message="" /> : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
