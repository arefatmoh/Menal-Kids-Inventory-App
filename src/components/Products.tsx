import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, PlusCircle, MinusCircle, ChevronDown, ChevronUp, Calendar, Printer } from 'lucide-react';
import { ProductForm } from './ProductForm';
import { StockAdjustment } from './StockAdjustment';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import JsBarcode from 'jsbarcode';
import { fetchCategories as fetchCategoriesUtil, addCategory } from '../utils/categories';
import { findProductByBarcode } from '../utils/barcode';



interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  expiry_date?: string;
  barcode?: string;
}

// Inline barcode renderer component
function InlineBarcode({ value, width = 1.2, height = 32, fontSize = 10 }: { value: string; width?: number; height?: number; fontSize?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: true,
          fontSize,
          margin: 2,
          background: 'transparent',
          lineColor: '#333333',
        });
      } catch (err) { /* ignore */ }
    }
  }, [value, width, height, fontSize]);
  return <svg ref={svgRef} />;
}

interface ProductsProps {
  isAdmin: boolean;
}

export function Products({ isAdmin }: ProductsProps) {
  const { currentBranchId } = useBranch();
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Full dataset in memory
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [lowStockExpanded, setLowStockExpanded] = useState(false);
  const [expiryExpanded, setExpiryExpanded] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Invisible barcode scanner listener
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scanLockRef = useRef(false);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Client-side filtering — instant, no server calls
  const filteredProducts = useMemo(() => {
    let result = allProducts;

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const paddedBarcode = q.padStart(5, '0');
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode === paddedBarcode)
      );
    }

    return result;
  }, [allProducts, selectedCategory, searchQuery]);

  // Client-side pagination
  const totalCount = filteredProducts.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const from = page * PAGE_SIZE;
    return filteredProducts.slice(from, from + PAGE_SIZE);
  }, [filteredProducts, page]);
  const hasMore = (page + 1) * PAGE_SIZE < totalCount;

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter' && scanBufferRef.current.length >= 3) {
        e.preventDefault();
        const code = scanBufferRef.current;
        scanBufferRef.current = '';
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

        if (!scanLockRef.current) {
          scanLockRef.current = true;
          (async () => {
            try {
              if (!currentBranchId) return;
              const product = await findProductByBarcode(currentBranchId, code);
              if (!product) {
                toast.error(`No product matched barcode "${code}"`);
                return;
              }
              // Set search to barcode so the product list filters to show it
              setSearchQuery(product.barcode || code);
              setSelectedCategory('all');
              setSelectedProductId(product.id);
              toast.success(`Found "${product.name}" — barcode ${code}`);
              // Scroll to product after filter updates
              setTimeout(() => {
                const el = document.getElementById(`product-${product.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            } catch (err) {
              console.error('Barcode scan error:', err);
              toast.error('Failed to look up barcode');
            } finally {
              scanLockRef.current = false;
            }
          })();
        }
        return;
      }

      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentBranchId]);

  // Load ALL products once into memory
  const fetchAllProducts = async () => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menal_products')
        .select('*')
        .eq('branch_id', currentBranchId)
        .not('name', 'like', '[Category Placeholder]%')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42703' || error.code === '42P01') {
          console.error('Database schema error:', error);
          toast.error('Database not set up. Please run the SQL schema in Supabase Dashboard. See SUPABASE_SETUP_GUIDE.md');
          return;
        }
        throw error;
      }

      setAllProducts(data || []);
    } catch (error) {
      console.error('Products fetch error:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (currentBranchId) {
      fetchAllProducts();
      fetchCategories();
    }
  }, [currentBranchId]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      // 1. Get product details before deletion
      const { data: product } = await supabase
        .from('menal_products')
        .select('*')
        .eq('id', id)
        .single();

      // 2. Log deletion activity BEFORE the product is gone
      const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await supabase.from('menal_activity_log').insert({
        id: logId,
        branch_id: currentBranchId,
        type: 'product_deleted',
        details: `Product "${name}" deleted (ID: ${id})`,
        metadata: { ...product, productName: name, originalProductId: id },
      });

      // 3. Delete the product
      const { error } = await supabase
        .from('menal_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Product deleted successfully!');
      fetchAllProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      toast.error('Failed to delete product');
    }
  };

  const fetchCategories = async () => {
    if (!currentBranchId) return;
    try {
      const categories = await fetchCategoriesUtil(currentBranchId);
      setCategories(['all', ...categories]);
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !currentBranchId) return;

    const categoryName = newCategory.trim();
    
    // Check if category already exists
    if (categories.includes(categoryName)) {
      toast.error('Category already exists');
      return;
    }

    // Optimistic update
    setCategories(prev => {
      const withoutAll = prev.filter(c => c !== 'all');
      return ['all', ...[...withoutAll, categoryName].sort()];
    });
    setNewCategory('');
    setShowAddCategory(false);

    const result = await addCategory(currentBranchId, categoryName);
    
    if (!result.success) {
      // Rollback optimistic update
      setCategories(prev => prev.filter(cat => cat !== categoryName));
      toast.error(result.error || 'Failed to add category');
      return;
    }

    toast.success(`Category "${categoryName}" added successfully`);
    fetchCategories(); // Refresh categories
    fetchAllProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleAddStock = (product: Product) => {
    setAdjustingProduct({ ...product, adjustmentType: 'add' } as any);
    setShowStockAdjustment(true);
  };

  const handleRemoveStock = (product: Product) => {
    setAdjustingProduct({ ...product, adjustmentType: 'remove' } as any);
    setShowStockAdjustment(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleStockAdjustmentClose = () => {
    setShowStockAdjustment(false);
    setAdjustingProduct(null);
  };

  const lowStockProducts = allProducts.filter(p => p.stock <= p.minStock && p.stock > 0);

  // Calculate expiring products
  const now = new Date();
  const expiringProducts = allProducts.filter(p => p.expiry_date)
    .map(p => ({
      ...p,
      daysUntilExpiry: Math.ceil((new Date(p.expiry_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }))
    .filter(p => p.daysUntilExpiry <= 180 && p.daysUntilExpiry > 0) // Show products expiring in the next 6 months
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  if (loading) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Products</h2>

        {/* Floating Add Button - Admins Only */}
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center rounded-full shadow-lg transition-all active:scale-95 hover:scale-110"
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(113, 67, 41, 0.3)',
              border: 'none',
              cursor: 'pointer'
            }}
            aria-label="Add Product"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div
          className="rounded-2xl shadow-sm cursor-pointer"
          style={{ backgroundColor: '#FEF3C7', padding: '16px 20px', marginBottom: '20px' }}
          onClick={() => setLowStockExpanded(!lowStockExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
              <p style={{ color: 'var(--text-primary)' }}>
                {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''} low on stock
              </p>
            </div>
            {lowStockExpanded ? (
              <ChevronUp size={20} style={{ color: 'var(--text-primary)' }} />
            ) : (
              <ChevronDown size={20} style={{ color: 'var(--text-primary)' }} />
            )}
          </div>
          {lowStockExpanded && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              {lowStockProducts.map((product) => (
                <div
                  key={`low-stock-${product.id}`}
                  className="flex items-center justify-between py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>{product.name}</span>
                  <span style={{ color: 'var(--danger)' }}>
                    {product.stock} / {product.minStock} units
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expiring Products Alert */}
      {expiringProducts.length > 0 && (
        <div
          className="rounded-2xl shadow-sm cursor-pointer"
          style={{ backgroundColor: '#FEEBC8', padding: '16px 20px', marginBottom: '20px' }}
          onClick={() => setExpiryExpanded(!expiryExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar size={20} style={{ color: 'var(--warning)' }} />
              <p style={{ color: 'var(--text-primary)' }}>
                {expiringProducts.length} product{expiringProducts.length > 1 ? 's' : ''} expiring soon
              </p>
            </div>
            {expiryExpanded ? (
              <ChevronUp size={20} style={{ color: 'var(--text-primary)' }} />
            ) : (
              <ChevronDown size={20} style={{ color: 'var(--text-primary)' }} />
            )}
          </div>
          {expiryExpanded && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              {expiringProducts.map((product) => (
                <div
                  key={`expiring-${product.id}`}
                  className="flex items-center justify-between py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>{product.name}</span>
                  <span style={{ color: 'var(--warning)' }}>
                    {product.daysUntilExpiry} days left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '20px', marginBottom: '20px' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '16px' }}>
          <Search size={20} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg border-none outline-none"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
            key="products-search-input"
          />
        </div>

        {/* Category Filter */}
        <div
          className="flex gap-2"
          style={{
            marginBottom: '16px',
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
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1.5 rounded-lg transition-all capitalize text-xs whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--gray-light)',
                color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-primary)',
                border: `1px solid ${selectedCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {cat}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setShowAddCategory(true)}
              className="px-4 py-2 rounded-lg transition-all text-sm flex items-center gap-1"
              style={{
                backgroundColor: 'var(--secondary)',
                color: 'var(--primary)',
                border: '1px dashed var(--primary)',
              }}
            >
              <Plus size={16} />
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl" style={{ backgroundColor: 'var(--background)', padding: '24px' }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Add New Category</h3>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter category name"
              className="w-full px-4 py-3 rounded-lg border outline-none"
              style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)', borderColor: 'var(--border)', marginBottom: '20px' }}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategory('');
                }}
                className="flex-1 py-3 rounded-lg transition-all"
                style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="flex-1 py-3 rounded-lg transition-all"
                style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div className="text-center rounded-2xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '48px 24px' }}>
          <Package size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-primary)' }}>No products found</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery || selectedCategory !== 'all' ? 'Try adjusting your filters' : 'Add your first product to get started'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {paginatedProducts.map((product) => {
            const isExpanded = selectedProductId === product.id;

            return (
              <div
                key={`product-${product.id}`}
                id={`product-${product.id}`}
                onClick={() => setSelectedProductId(isExpanded ? null : product.id)}
                className="rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md"
                style={{
                  backgroundColor: product.stock <= product.minStock && product.minStock > 0
                    ? '#FEF2F2'
                    : 'var(--background)',
                  borderColor: isExpanded
                    ? 'var(--primary)'
                    : product.stock <= product.minStock && product.minStock > 0
                      ? '#FCA5A5'
                      : 'var(--border)',
                  borderWidth: isExpanded ? '2px' : '1px',
                  padding: isExpanded ? '11px 15px' : '12px 16px',
                  transform: isExpanded ? 'scale(1.01)' : 'scale(1)'
                }}
              >
                {/* Main Product Info - Always Visible */}
                <div className="flex items-center gap-3">
                  {/* Product Name & Category */}
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <h4 className="text-sm" style={{
                      color: 'var(--text-primary)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      lineHeight: '1.4'
                    }}>
                      {product.barcode && (
                        <span
                          className="text-xs"
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginRight: '6px',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          {product.barcode}
                        </span>
                      )}
                      {product.name}
                    </h4>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                      {product.category}
                    </p>
                  </div>

                  {/* Price */}
                  <div style={{ minWidth: '70px', textAlign: 'right' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {Math.round(product.price)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
                    </p>
                  </div>

                  {/* Stock */}
                  <div style={{ minWidth: '65px', textAlign: 'right' }}>
                    <p className="text-sm" style={{
                      color: product.stock <= product.minStock && product.minStock > 0
                        ? 'var(--danger)'
                        : 'var(--text-primary)'
                    }}>
                      {product.stock} <span className="text-xs" style={{ opacity: 0.7 }}>units</span>
                    </p>
                    {product.minStock > 0 && (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        min: {product.minStock}
                      </p>
                    )}
                  </div>

                  {/* Expand Indicator */}
                  <div style={{ minWidth: '24px', textAlign: 'center' }}>
                    {isExpanded ? (
                      <ChevronUp size={18} style={{ color: 'var(--primary)' }} />
                    ) : (
                      <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </div>
                </div>

                {/* Expanded Content - Actions & Notes */}
                {isExpanded && (
                  <div
                    className="transition-all"
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--border)',
                      animation: 'slideDown 0.2s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Barcode Display */}
                    {product.barcode && (
                      <div
                        className="rounded-lg flex items-center justify-between"
                        style={{
                          backgroundColor: 'var(--gray-light)',
                          padding: '10px 12px',
                          marginBottom: '16px',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <InlineBarcode value={product.barcode} />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const printWindow = window.open('', '_blank', 'width=800,height=600');
                            if (printWindow) {
                              // Fill A4 page: 5 cols × 17 rows = 85 labels
                              const totalLabels = 85;
                              const labels = Array(totalLabels).fill(null).map(() => `
                                <div class="label">
                                  <svg class="barcode" data-value="${product.barcode}"></svg>
                                </div>
                              `).join('');

                              printWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                <head>
                                  <title>Barcode Labels - ${product.barcode}</title>
                                  <style>
                                    * { margin: 0; padding: 0; box-sizing: border-box; }
                                    @page { size: A4; margin: 2mm; }
                                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
                                    .grid {
                                      display: grid;
                                      grid-template-columns: repeat(5, 1fr);
                                      gap: 1mm;
                                      padding: 1mm;
                                    }
                                    .label {
                                      border: 0.3px dashed #ccc;
                                      padding: 1mm;
                                      text-align: center;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      page-break-inside: avoid;
                                      min-height: 16mm;
                                    }
                                    .label svg { max-width: 100%; height: auto; }
                                    @media print {
                                      body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                                      .label { border-color: #ddd; }
                                      .no-print { display: none !important; }
                                    }
                                    .no-print { text-align: center; padding: 16px; background: #f5f5f5; border-bottom: 1px solid #ddd; }
                                    .no-print button { padding: 10px 24px; background: #714329; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; margin: 0 8px; }
                                    .no-print button:hover { opacity: 0.9; }
                                    .no-print .info { font-size: 13px; color: #666; margin-top: 8px; }
                                  </style>
                                </head>
                                <body>
                                  <div class="no-print">
                                    <button onclick="window.print()">🖨️ Print Labels</button>
                                    <button onclick="window.close()" style="background:#888">Close</button>
                                    <div class="info">${totalLabels} labels of barcode ${product.barcode} • 5 per row</div>
                                  </div>
                                  <div class="grid">${labels}</div>
                                  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
                                  <script>
                                    document.querySelectorAll('.barcode').forEach(function(svg) {
                                      var value = svg.getAttribute('data-value');
                                      if (value) {
                                        JsBarcode(svg, value, {
                                          format: 'CODE128', width: 1.2, height: 28, displayValue: true,
                                          fontSize: 10, margin: 0, background: 'transparent',
                                          lineColor: '#000000', textMargin: 0
                                        });
                                      }
                                    });
                                  </script>
                                </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="p-2 rounded-lg transition-all active:scale-95 flex-shrink-0"
                          style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', marginLeft: '12px' }}
                          title="Print Barcode Page"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    )}
                    {/* Notes/Description */}
                    {product.notes && (
                      <div
                        className="rounded-lg text-sm"
                        style={{
                          backgroundColor: 'var(--gray-light)',
                          color: 'var(--text-secondary)',
                          padding: '12px',
                          marginBottom: '16px',
                          fontStyle: 'italic'
                        }}
                      >
                        {product.notes}
                      </div>
                    )}

                    {/* Action Buttons - Admins Only */}
                    {isAdmin && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(product);
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            padding: '10px',
                            border: 'none'
                          }}
                        >
                          <Edit size={16} />
                          <span className="text-sm">Edit</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product.id, product.name);
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                          style={{
                            backgroundColor: 'var(--gray-light)',
                            color: 'var(--danger)',
                            padding: '10px',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <Trash2 size={16} />
                          <span className="text-sm">Delete</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdjustingProduct({ ...product, adjustmentType: 'add' } as any);
                            setShowStockAdjustment(true);
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                          style={{
                            backgroundColor: 'var(--success)',
                            color: '#FFFFFF',
                            padding: '10px',
                            border: 'none'
                          }}
                        >
                          <PlusCircle size={16} />
                          <span className="text-sm">Add Stock</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdjustingProduct({ ...product, adjustmentType: 'remove' } as any);
                            setShowStockAdjustment(true);
                          }}
                          className="flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95"
                          style={{
                            backgroundColor: 'var(--danger)',
                            color: '#FFFFFF',
                            padding: '10px',
                            border: 'none'
                          }}
                        >
                          <MinusCircle size={16} />
                          <span className="text-sm">Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {totalCount === 0 ? 0 : page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setPage(prev => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="pagination-btn"
          >
            Previous
          </button>

          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Page {page + 1} of {totalPages}
          </span>

          <button
            onClick={() => setPage(prev => prev + 1)}
            disabled={!hasMore}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={handleFormClose}
          onProductAdded={() => { fetchCategories(); fetchAllProducts(); }}
        />
      )}

      {/* Stock Adjustment Modal */}
      {showStockAdjustment && adjustingProduct && (
        <StockAdjustment
          product={adjustingProduct}
          onClose={handleStockAdjustmentClose}
          onSuccess={() => {
            fetchAllProducts();
          }}
        />
      )}
    </div>
  );
}