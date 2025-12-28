import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, PlusCircle, MinusCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { ProductForm } from './ProductForm';
import { StockAdjustment } from './StockAdjustment';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

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
}

interface ProductsProps {
  isAdmin: boolean;
}

export function Products({ isAdmin }: ProductsProps) {
  const { currentBranchId } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
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

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  /* 
     Update: Moving filtering to server-side to ensure pagination works correctly 
     with specific categories or search queries.
  */
  const fetchProducts = async (pageNumber: number, category: string, search: string, reset = false) => {
    // Only fetch if we have a branch ID
    if (!currentBranchId) return;

    setLoading(true);
    try {
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('menal_products')
        .select('*', { count: 'exact' }) // Get count for pagination
        .eq('branch_id', currentBranchId);

      // Apply server-side filters
      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        if (error.code === '42703' || error.code === '42P01') {
          console.error('Database schema error:', error);
          toast.error('Database not set up.');
          setProducts([]);
          setFilteredProducts([]); // filteredProducts is redundant now but kept for compatibility
          return;
        }
        throw error;
      }

      // Map database columns to component interface
      const mappedProducts = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price ?? 0,
        stock: p.stock ?? 0,
        minStock: p.min_stock || 0,
        notes: p.notes || '',
        createdAt: p.created_at,
        updatedAt: p.created_at,
        expiry_date: p.expiry_date
      }));

      // Determine if there are more items
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setProducts(mappedProducts);
      setFilteredProducts(mappedProducts);
      setTotalCount(count || 0);

      if (reset) fetchCategories();
    } catch (error) {
      console.error('Products fetch error:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    // Debounce search could be added here, but for now direct call
    const timer = setTimeout(() => {
      fetchProducts(0, selectedCategory, searchQuery, true);
    }, 300); // Small delay for typing
    return () => clearTimeout(timer);
  }, [currentBranchId, selectedCategory, searchQuery]);

  // Remove the old client-side filtering useEffect
  // useEffect(() => { ... }) 

  const handleNextPage = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, selectedCategory, searchQuery, false);
  };

  const handlePrevPage = () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    fetchProducts(prevPage, selectedCategory, searchQuery, false);
  };

  /* 
     Client-side filtering removed in favor of Server-side filtering 
     to support correct pagination.
  */



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
      // We store the ID in metadata instead of the product_id column
      // so the CASCADE doesn't delete this log entry itself.
      const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await supabase.from('menal_activity_log').insert({
        id: logId,
        branch_id: currentBranchId,
        type: 'product_deleted',
        details: `Product "${name}" deleted (ID: ${id})`,
        metadata: { ...product, productName: name, originalProductId: id },
      });

      // 3. Delete the product (CASCADE handles old logs and sale items)
      const { error } = await supabase
        .from('menal_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Product deleted successfully!');
      fetchProducts(page, selectedCategory, searchQuery, false);
    } catch (error) {
      console.error('Delete product error:', error);
      toast.error('Failed to delete product');
    }
  };

  const fetchCategories = async () => {
    if (!currentBranchId) return;
    try {
      const { data, error } = await supabase
        .from('menal_product_categories')
        .select('name')
        .eq('branch_id', currentBranchId)
        .order('name');

      if (error) throw error;

      const categoryList = data.map(c => c.name);
      setCategories(['all', ...categoryList]);
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !currentBranchId) return;

    // Optimistic update
    const categoryName = newCategory.trim();
    setCategories(prev => [...prev, categoryName].sort());
    setNewCategory('');
    setShowAddCategory(false);

    try {
      const { error } = await supabase
        .from('menal_product_categories')
        .insert({
          branch_id: currentBranchId,
          name: categoryName
        });

      if (error) {
        // Rollback if duplicate or error
        if (error.code === '23505') { // Unique violation
          toast.error('Category already exists');
        } else {
          throw error;
        }
        fetchCategories(); // Refresh to be safe
        return;
      }

      toast.success('Category added successfully');
      fetchCategories();
    } catch (error) {
      console.error('Add category error:', error);
      toast.error('Failed to save category');
      fetchCategories(); // Revert
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleAddStock = (product: Product) => {
    setAdjustingProduct({ ...product, adjustment: 1 } as any);
    setShowStockAdjustment(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProduct(null);
    fetchProducts(page, selectedCategory, searchQuery, false);
  };

  const handleStockAdjustmentClose = () => {
    setShowStockAdjustment(false);
    setAdjustingProduct(null);
    fetchProducts(page, selectedCategory, searchQuery, false);
  };

  const lowStockProducts = products.filter(p => p.stock <= p.minStock && p.minStock > 0);

  // Calculate expiring products
  const now = new Date();
  const expiringProducts = products.filter(p => p.expiry_date)
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

        {/* Floating Add Button - All Users */}
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
                  key={product.id}
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
                  key={product.id}
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
          {filteredProducts.map((product) => {
            const isExpanded = selectedProductId === product.id;

            return (
              <div
                key={product.id}
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
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
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

                    {/* Action Buttons - All Users */}
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
          Showing {Math.min(totalCount, page * PAGE_SIZE + 1)}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              const prevPage = Math.max(0, page - 1);
              setPage(prevPage);
              fetchProducts(prevPage, selectedCategory, searchQuery);
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
              fetchProducts(nextPage, selectedCategory, searchQuery);
            }}
            disabled={!hasMore || loading}
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
        />
      )}

      {/* Stock Adjustment Modal */}
      {showStockAdjustment && adjustingProduct && (
        <StockAdjustment
          product={adjustingProduct}
          onClose={handleStockAdjustmentClose}
        />
      )}
    </div>
  );
}