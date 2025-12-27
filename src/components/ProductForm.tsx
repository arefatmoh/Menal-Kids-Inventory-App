import { useState, useEffect } from 'react';
import { X, Package, Tag, DollarSign, Layers, Bell, FileText } from 'lucide-react';
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
}

interface ProductFormProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductForm({ product, onClose }: ProductFormProps) {
  const { currentBranchId } = useBranch();
  const [formData, setFormData] = useState({
    name: '',
    category: '', // No default hardcoded category
    price: '',
    stock: '',
    minStock: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchCategories();
  }, [currentBranchId]);

  const fetchCategories = async () => {
    if (!currentBranchId) return;
    try {
      // Fetch from the persistent categories table
      const { data, error } = await supabase
        .from('menal_product_categories')
        .select('name')
        .eq('branch_id', currentBranchId)
        .order('name');

      if (error) throw error;

      // Map to array of strings
      const catList = data.map(c => c.name);
      setCategories(catList);

      // If editing, ensure the product's category is in the list
      if (product && !catList.includes(product.category)) {
        setCategories(prev => [...prev, product.category].sort());
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // No fallback categories - exact user request
      setCategories([]);
    }
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price.toString(),
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
        notes: product.notes,
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.stock || !formData.category) {
      toast.error('Please fill in all required fields (Name, Category, Stock)');
      return;
    }

    setLoading(true);

    try {
      const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const productData = {
        name: formData.name,
        category: formData.category,
        price: formData.price ? parseFloat(formData.price) : 0,
        stock: parseInt(formData.stock),
        min_stock: formData.minStock ? parseInt(formData.minStock) : 0,
        notes: formData.notes || null,
        branch_id: currentBranchId,
      };

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('menal_products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;

        // Log product update activity
        await supabase.from('menal_activity_log').insert({
          id: generateId(),
          type: 'product_created', // Using same type as create for simplicity
          product_id: product.id,
          branch_id: currentBranchId,
          details: `Product "${formData.name}" updated`,
          metadata: { ...productData, productName: formData.name },
        });
      } else {
        // Create new product with ID
        const newProductId = generateId();
        const { error } = await supabase
          .from('menal_products')
          .insert({ ...productData, id: newProductId });

        if (error) throw error;

        // Log product creation activity
        await supabase.from('menal_activity_log').insert({
          id: generateId(),
          type: 'product_created',
          product_id: newProductId,
          branch_id: currentBranchId,
          details: `Product "${formData.name}" created with stock: ${formData.stock}`,
          metadata: { ...productData, stock: parseInt(formData.stock), productName: formData.name },
        });
      }

      toast.success(`Product ${product ? 'updated' : 'added'} successfully! 🎉`);
      onClose();
    } catch (error) {
      console.error('Save product error:', error);
      toast.error('Failed to save product');
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
            backgroundColor: 'var(--background)',
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
                backgroundColor: 'var(--secondary)'
              }}
            >
              <Package size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '2px' }}>
                {product ? 'Edit Product' : 'Add New Product'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Fill in the product details below
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
            {/* Product Name */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <Package size={16} style={{ color: 'var(--primary)' }} />
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Premium Foundation"
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
                <Tag size={16} style={{ color: 'var(--primary)' }} />
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border outline-none capitalize transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)'
                }}
                required
              >
                <option value="" disabled>Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="capitalize">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Price & Stock - Two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                  <DollarSign size={16} style={{ color: 'var(--primary)' }} />
                  Price (br)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--gray-light)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border)'
                  }}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                  Stock *
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
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

            {/* Min Stock - Full width now */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <Bell size={16} style={{ color: 'var(--primary)' }} />
                Min Stock Alert
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border)'
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                <FileText size={16} style={{ color: 'var(--primary)' }} />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
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
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(113, 67, 41, 0.2)'
              }}
            >
              {loading ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}