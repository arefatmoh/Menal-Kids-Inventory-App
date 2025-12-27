import { useEffect, useState } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, DollarSign, Check } from 'lucide-react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { CustomerSelector } from './CustomerSelector';
import { TierUpgradeCelebration } from './TierUpgradeCelebration';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number | string; // Allow string for empty input state
  originalPrice: number;
  stock: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  total_purchases: number;
  total_visits: number;
  tier_name?: string;
  tier_color?: string;
  tier_icon?: string;
  discount_percentage?: number;
}

type PaymentMethod = 'cash' | 'bank' | 'telebirr';

export function Sell() {
  const { currentBranchId } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentSplits, setPaymentSplits] = useState({ cash: 0, bank: 0, telebirr: 0 });
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showTierUpgrade, setShowTierUpgrade] = useState(false);
  const [tierUpgradeData, setTierUpgradeData] = useState<any>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const PRODUCTS_PER_PAGE = 20;

  const fetchProducts = async (pageNumber = 0, category = 'all', search = '') => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('menal_products')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
        .gt('stock', 0);

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const from = pageNumber * PRODUCTS_PER_PAGE;
      const to = from + PRODUCTS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order('name', { ascending: true })
        .range(from, to);

      if (error) {
        if (error.code === '42703' || error.code === '42P01') {
          console.error('Database schema error:', error);
          setProducts([]);
          setHasMore(false);
          return;
        }
        throw error;
      }

      const newProducts = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price ?? 0,
        stock: p.stock ?? 0,
      }));

      if (newProducts.length < PRODUCTS_PER_PAGE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setProducts(newProducts);
      setFilteredProducts(newProducts);
      setTotalCount(count || 0);

      // We still need categories for the filter dropdown
      // Note: In a real efficient app, we'd fetch distinct categories separately
      // For now, we'll keep the existing category logic if possible, 
      // but strictly speaking, we might not see all categories if they are on page 2.
      // A separate category fetch is better, but let's stick to the requested scope first.
      // Actually, let's try to fetch categories separately once to ensure the dropdown is full.
      if (pageNumber === 0 && category === 'all' && !search) {
        fetchCategories();
      }

    } catch (error) {
      console.error('Products fetch error:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('menal_product_categories')
      .select('name')
      .eq('branch_id', currentBranchId);

    if (data) {
      setCategories(['all', ...data.map(c => c.name)]);
    }
  };

  useEffect(() => {
    setPage(0);
    const timer = setTimeout(() => {
      fetchProducts(0, selectedCategory, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentBranchId, selectedCategory, searchQuery]);

  const handleNextPage = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, selectedCategory, searchQuery);
  };

  const handlePrevPage = () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    fetchProducts(prevPage, selectedCategory, searchQuery);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Not enough stock available');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        originalPrice: product.price,
        stock: product.stock,
      }]);
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) return item;
        if (newQuantity > item.stock) {
          alert('Not enough stock available');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updatePrice = (productId: string, newPrice: string) => {
    if (newPrice === '') {
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, price: '' }
          : item
      ));
      return;
    }

    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, price }
        : item
    ));
  };

  const handlePriceBlur = (productId: string) => {
    setCart(cart.map(item => {
      if (item.productId === productId && item.price === '') {
        return { ...item, price: 0 };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => {
    const price = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
    return sum + (price * item.quantity);
  }, 0);
  const discountAmount = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmount);

  // Calculate tier discount if customer has one
  const tierDiscountPercentage = selectedCustomer?.discount_percentage || 0;
  const tierDiscountAmount = tierDiscountPercentage > 0 ? (subtotal * tierDiscountPercentage / 100) : 0;

  const applyTierDiscount = () => {
    if (tierDiscountAmount > 0) {
      setDiscount(tierDiscountAmount.toFixed(2));
      toast.success(`Applied ${tierDiscountPercentage}% ${selectedCustomer?.tier_name} discount!`);
    }
  };

  // Calculate payment totals
  const totalPaid = paymentSplits.cash + paymentSplits.bank + paymentSplits.telebirr;
  const remaining = total - totalPaid;

  // Determine if payment is complete based on mode
  const isSplitMode = showSplitPayment;
  const isPaymentComplete = isSplitMode
    ? Math.abs(remaining) < 0.01  // Split mode: must match exact total
    : true;  // Single method mode: always ready
  const isOverpaid = remaining < -0.01;

  const updatePaymentSplit = (method: 'cash' | 'bank' | 'telebirr', value: string) => {
    const amount = parseFloat(value) || 0;
    if (amount < 0) return;
    setPaymentSplits({ ...paymentSplits, [method]: amount });
  };

  const payAll = (method: 'cash' | 'bank' | 'telebirr') => {
    // Reset other methods and pay full remaining with this method
    const currentMethodAmount = paymentSplits[method];
    const otherMethodsTotal = totalPaid - currentMethodAmount;
    const amountNeeded = Math.max(0, total - otherMethodsTotal);

    setPaymentSplits({ ...paymentSplits, [method]: amountNeeded });
  };

  const clearPayments = () => {
    setPaymentSplits({ cash: 0, bank: 0, telebirr: 0 });
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!isPaymentComplete) {
      toast.error('Please complete payment allocation before finalizing sale');
      return;
    }

    setProcessing(true);

    try {
      // Helper function to generate IDs
      const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate total
      const subtotal = cart.reduce((sum, item) => {
        const price = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
        return sum + (price * item.quantity);
      }, 0);
      const finalTotal = Math.max(0, subtotal - discountAmount);

      // Handle customer creation if name and phone provided but not selected
      let customerId = selectedCustomer?.id || null;

      // Debug logging
      console.log('Customer Debug:', {
        selectedCustomer,
        customerName,
        customerPhone,
        hasSelectedCustomer: !!selectedCustomer,
        hasNameAndPhone: !!(customerName.trim() && customerPhone.trim())
      });

      if (!selectedCustomer && customerName.trim() && customerPhone.trim()) {
        // Try to create new customer
        try {
          console.log('Attempting to create customer:', { name: customerName.trim(), phone: customerPhone.trim() });

          const { data: newCustomer, error: customerError } = await supabase
            .from('menal_customers')
            .insert({
              name: customerName.trim(),
              phone: customerPhone.trim(),
              branch_id: currentBranchId,
            })
            .select()
            .single();

          if (customerError) {
            console.error('Customer creation error:', customerError);
            // If duplicate phone, try to find existing customer
            if (customerError.code === '23505') {
              const { data: existingCustomer } = await supabase
                .from('menal_customers')
                .select('id')
                .eq('phone', customerPhone.trim())
                .single();

              if (existingCustomer) {
                customerId = existingCustomer.id;
                console.log('Using existing customer:', customerId);
              }
            }
          } else if (newCustomer) {
            customerId = newCustomer.id;
            console.log('Created new customer:', customerId);
          }
        } catch (error) {
          console.error('Customer creation error:', error);
          // Continue with sale even if customer creation fails
        }
      }

      console.log('Final customerId for sale:', customerId);

      let primaryMethod: PaymentMethod = paymentMethod;
      let paymentDetails: any = null;

      // If using split payment, save the split details
      if (showSplitPayment) {
        // Determine primary payment method (the one with highest amount)
        if (paymentSplits.bank > paymentSplits.cash && paymentSplits.bank > paymentSplits.telebirr) {
          primaryMethod = 'bank';
        } else if (paymentSplits.telebirr > paymentSplits.cash && paymentSplits.telebirr > paymentSplits.bank) {
          primaryMethod = 'telebirr';
        } else {
          primaryMethod = 'cash';
        }

        paymentDetails = {
          cash: paymentSplits.cash,
          bank: paymentSplits.bank,
          telebirr: paymentSplits.telebirr,
          total_paid: totalPaid,
          is_split: true
        };
      } else {
        // Single payment method - store full amount in that method
        paymentDetails = {
          cash: paymentMethod === 'cash' ? finalTotal : 0,
          bank: paymentMethod === 'bank' ? finalTotal : 0,
          telebirr: paymentMethod === 'telebirr' ? finalTotal : 0,
          total_paid: finalTotal,
          is_split: false
        };
      }


      // Prepare items for RPC
      const rpcItems = cart.map(item => {
        const price = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price;
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: price,
          originalPrice: price,
          total: price * item.quantity
        };
      });

      // Call the transactional RPC function
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('menal_process_sale', {
          p_branch_id: currentBranchId,
          p_customer_id: customerId,
          p_total: subtotal,
          p_discount: discountAmount,
          p_final_total: finalTotal,
          p_payment_method: primaryMethod,
          p_payment_details: paymentDetails,
          p_items: rpcItems
        });

      if (rpcError) throw rpcError;

      // Check for tier upgrade if customer exists
      if (customerId) {
        await checkTierUpgrade(customerId);
      }

      setShowConfirmation(true);
      toast.success('Sale completed successfully! 🎉');
      setTimeout(() => {
        setCart([]);
        setDiscount('0');
        setPaymentSplits({ cash: 0, bank: 0, telebirr: 0 });
        setShowSplitPayment(false);
        setShowConfirmation(false);
        setSelectedCustomer(null);
        setCustomerName('');
        setCustomerPhone('');
        fetchProducts(); // Refresh products to update stock
      }, 2000);
    } catch (error: any) {
      console.error('Complete sale error:', error);
      // Handle insufficient stock error specifically
      if (error.message && error.message.includes('Insufficient stock')) {
        toast.error(error.message);
      } else {
        toast.error('Failed to complete sale. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const checkTierUpgrade = async (customerId: string) => {
    try {
      // Fetch updated customer with current tier
      const { data: customer } = await supabase
        .from('menal_customers_with_segments')
        .select('*')
        .eq('id', customerId)
        .single();

      if (!customer) return;

      // Check tier history for recent upgrades
      const { data: recentHistory } = await supabase
        .from('menal_customer_tier_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (recentHistory && recentHistory.length > 0) {
        const latestChange = recentHistory[0];
        const timeSinceUpgrade = Date.now() - new Date(latestChange.changed_at).getTime();

        // If upgrade happened in the last 10 seconds, show celebration
        if (timeSinceUpgrade < 10000 && latestChange.old_tier_name !== latestChange.new_tier_name) {
          setTierUpgradeData({
            customerName: customer.customer_name,
            oldTierName: latestChange.old_tier_name,
            newTierName: latestChange.new_tier_name || customer.tier_name,
            newTierColor: customer.tier_color || '#714329',
            newTierIcon: customer.tier_icon || 'medal',
            discountPercentage: customer.discount_percentage || 0,
          });
          setShowTierUpgrade(true);
        }
      }
    } catch (error) {
      console.error('Error checking tier upgrade:', error);
      // Don't show error to user - this is just a nice-to-have feature
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div style={{ paddingBottom: cart.length > 0 ? '140px' : '0' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Sell Products</h2>

      {/* Sticky Collapsible Cart - Only shows when cart has items */}
      {cart.length > 0 && (
        <div
          className="sticky rounded-xl shadow-md border transition-all cursor-pointer"
          style={{
            top: '16px',
            backgroundColor: 'var(--background)',
            borderColor: cartExpanded ? 'var(--primary)' : 'var(--border)',
            borderWidth: cartExpanded ? '2px' : '1px',
            padding: cartExpanded ? '15px' : '12px 16px',
            marginBottom: '16px',
            zIndex: 10,
            maxHeight: cartExpanded ? 'calc(100vh - 180px)' : 'auto',
            overflowY: cartExpanded ? 'auto' : 'visible'
          }}
          onClick={() => !cartExpanded && setCartExpanded(true)}
        >
          {/* Collapsed View - Summary */}
          {!cartExpanded && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Cart ({cart.length})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--primary)' }}>
                  {Math.round(total)} <span className="text-xs" style={{ opacity: 0.7 }}>br</span>
                </span>
                <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
          )}

          {/* Expanded View - Full Cart */}
          {cartExpanded && (
            <div onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}
                onClick={() => setCartExpanded(false)}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                  </span>
                </div>
                <ChevronUp size={18} style={{ color: 'var(--primary)' }} />
              </div>

              {/* Cart Items */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '12px',
                  maxHeight: showSplitPayment ? '25vh' : '35vh',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-lg"
                    style={{ backgroundColor: 'var(--gray-light)', padding: '10px' }}
                  >
                    <div className="flex items-start justify-between" style={{ marginBottom: '8px' }}>
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.productName} <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>({item.stock})</span>
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1 rounded transition-all"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label className="text-xs block" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Quantity
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="p-1.5 rounded transition-all"
                            style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                          >
                            <Minus size={15} />
                          </button>
                          <span className="text-sm min-w-[1.5rem] text-center" style={{ color: 'var(--text-primary)' }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="p-1.5 rounded transition-all"
                            style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs block" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Price (br)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updatePrice(item.productId, e.target.value)}
                          onBlur={() => handlePriceBlur(item.productId)}
                          className="w-full px-2 py-1.5 rounded text-sm border-none outline-none"
                          style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Item Total:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {Math.round((typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price) * item.quantity)} <span style={{ opacity: 0.7 }}>br</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment Method - 4 buttons in a row: Cash, Bank, Telebirr, Split */}
              <div style={{ marginBottom: '10px' }}>
                <label className="text-xs block" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>
                  <button
                    onClick={() => {
                      setPaymentMethod('cash');
                      setShowSplitPayment(false);
                    }}
                    className="rounded text-xs transition-all"
                    style={{
                      backgroundColor: !showSplitPayment && paymentMethod === 'cash' ? 'var(--primary)' : 'var(--gray-light)',
                      color: !showSplitPayment && paymentMethod === 'cash' ? '#FFFFFF' : 'var(--text-primary)',
                      padding: '8px 2px',
                      border: `1px solid ${!showSplitPayment && paymentMethod === 'cash' ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('bank');
                      setShowSplitPayment(false);
                    }}
                    className="rounded text-xs transition-all"
                    style={{
                      backgroundColor: !showSplitPayment && paymentMethod === 'bank' ? 'var(--primary)' : 'var(--gray-light)',
                      color: !showSplitPayment && paymentMethod === 'bank' ? '#FFFFFF' : 'var(--text-primary)',
                      padding: '8px 2px',
                      border: `1px solid ${!showSplitPayment && paymentMethod === 'bank' ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    Bank
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('telebirr');
                      setShowSplitPayment(false);
                    }}
                    className="rounded text-xs transition-all"
                    style={{
                      backgroundColor: !showSplitPayment && paymentMethod === 'telebirr' ? 'var(--primary)' : 'var(--gray-light)',
                      color: !showSplitPayment && paymentMethod === 'telebirr' ? '#FFFFFF' : 'var(--text-primary)',
                      padding: '8px 2px',
                      border: `1px solid ${!showSplitPayment && paymentMethod === 'telebirr' ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    Telebirr
                  </button>
                  <button
                    onClick={() => setShowSplitPayment(!showSplitPayment)}
                    className="rounded text-xs transition-all"
                    style={{
                      backgroundColor: showSplitPayment ? 'var(--primary)' : 'var(--gray-light)',
                      color: showSplitPayment ? '#FFFFFF' : 'var(--text-primary)',
                      padding: '8px 2px',
                      border: `1px solid ${showSplitPayment ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    Split
                  </button>
                </div>
              </div>

              {/* Discount - Now applies to all payment methods */}
              <div style={{ marginBottom: '12px' }}>
                <label className="text-xs block" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Discount (br)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded text-sm border-none outline-none"
                  style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
                />
                {/* Tier Discount Suggestion */}
                {tierDiscountPercentage > 0 && selectedCustomer && (
                  <button
                    onClick={applyTierDiscount}
                    className="w-full mt-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: selectedCustomer.tier_color ? `${selectedCustomer.tier_color}20` : 'var(--success)20',
                      color: selectedCustomer.tier_color || 'var(--success)',
                      padding: '8px',
                      border: `1px solid ${selectedCustomer.tier_color || 'var(--success)'}`,
                    }}
                  >
                    <span className="text-xs" style={{ fontWeight: '600' }}>
                      ⚡ Apply {tierDiscountPercentage}% {selectedCustomer.tier_name} Discount ({Math.round(tierDiscountAmount)} br)
                    </span>
                  </button>
                )}
              </div>

              {/* Customer Selector - Optional */}
              <div style={{ marginBottom: '12px' }}>
                <CustomerSelector
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  onCustomerNameChange={setCustomerName}
                  onCustomerPhoneChange={setCustomerPhone}
                />
              </div>

              {/* Split Payment Dropdown Section - Only shows when Split is selected */}
              {showSplitPayment && (
                <div
                  className="rounded-lg"
                  style={{
                    backgroundColor: isPaymentComplete ? '#F0FDF4' : isOverpaid ? '#FEF2F2' : 'var(--gray-light)',
                    padding: '12px',
                    marginBottom: '12px',
                    border: `2px solid ${isPaymentComplete ? 'var(--success)' : isOverpaid ? 'var(--danger)' : 'var(--border)'}`,
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                    <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Split Payment Amounts
                    </label>
                    <button
                      onClick={clearPayments}
                      className="text-xs transition-all"
                      style={{ color: 'var(--danger)' }}
                    >
                      Clear
                    </button>
                  </div>

                  {/* Payment Input Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', width: '100%' }}>
                    {/* Cash */}
                    <div className="flex items-center gap-2" style={{ width: '100%' }}>
                      <label className="text-xs" style={{ color: 'var(--text-secondary)', width: '60px', flexShrink: 0 }}>
                        Cash:
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={paymentSplits.cash || ''}
                        onChange={(e) => updatePaymentSplit('cash', e.target.value)}
                        placeholder="0"
                        className="flex-1 px-2 py-1.5 rounded text-xs border-none outline-none"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)', minWidth: 0 }}
                      />
                    </div>

                    {/* Bank */}
                    <div className="flex items-center gap-2" style={{ width: '100%' }}>
                      <label className="text-xs" style={{ color: 'var(--text-secondary)', width: '60px', flexShrink: 0 }}>
                        Bank:
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={paymentSplits.bank || ''}
                        onChange={(e) => updatePaymentSplit('bank', e.target.value)}
                        placeholder="0"
                        className="flex-1 px-2 py-1.5 rounded text-xs border-none outline-none"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)', minWidth: 0 }}
                      />
                    </div>

                    {/* Telebirr */}
                    <div className="flex items-center gap-2" style={{ width: '100%' }}>
                      <label className="text-xs" style={{ color: 'var(--text-secondary)', width: '60px', flexShrink: 0 }}>
                        Telebirr:
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={paymentSplits.telebirr || ''}
                        onChange={(e) => updatePaymentSplit('telebirr', e.target.value)}
                        placeholder="0"
                        className="flex-1 px-2 py-1.5 rounded text-xs border-none outline-none"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)', minWidth: 0 }}
                      />
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Paid:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {Math.round(totalPaid)} br
                      </span>
                    </div>
                    <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Due:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {Math.round(total)} br
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Remaining:</span>
                      <span style={{
                        color: isPaymentComplete ? 'var(--success)' : isOverpaid ? 'var(--danger)' : 'var(--warning)'
                      }}>
                        {Math.round(remaining)} br
                        {isPaymentComplete && ' ✓'}
                        {isOverpaid && ' (overpaid)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)', marginBottom: '10px' }}>
                <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{Math.round(subtotal)} <span style={{ opacity: 0.7 }}>br</span></span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs" style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                    <span style={{ color: 'var(--danger)' }}>-{Math.round(discountAmount)} <span style={{ opacity: 0.7 }}>br</span></span>
                  </div>
                )}
                <div className="flex justify-between" style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Total:</span>
                  <span style={{ color: 'var(--primary)' }}>{Math.round(total)} <span className="text-sm" style={{ opacity: 0.7 }}>br</span></span>
                </div>
              </div>

              {/* Complete Sale Button */}
              <button
                onClick={handleCompleteSale}
                disabled={processing || !isPaymentComplete}
                className="w-full flex items-center justify-center gap-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: 'var(--success)', color: '#FFFFFF', padding: '12px' }}
              >
                <DollarSign size={18} />
                <span className="text-sm">{processing ? 'Processing...' : isPaymentComplete ? 'Complete Sale' : 'Payment Incomplete'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '12px', marginBottom: '12px' }}>
        <div className="flex items-center gap-2">
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm rounded border-none outline-none"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Horizontal Scrolling Categories */}
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
      </div>

      {/* Ultra-Compact Product Grid - No Scrolling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => addToCart(product)}
            className="rounded-lg shadow-sm border transition-all active:scale-95 text-left"
            style={{
              backgroundColor: 'var(--gray-light)',
              borderColor: 'var(--border)',
              padding: '10px'
            }}
          >
            {/* Product Name - Wraps to 2 lines */}
            <p
              className="text-xs"
              style={{
                color: 'var(--text-primary)',
                marginBottom: '6px',
                lineHeight: '1.3',
                minHeight: '32px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {product.name}
            </p>

            {/* Price and Stock - Side by side with minimal gap */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs" style={{ color: 'var(--primary)' }}>
                {Math.round(product.price)} <span style={{ opacity: 0.7, fontSize: '10px' }}>br</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                {product.stock}u
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {Math.min(totalCount, page * PRODUCTS_PER_PAGE + 1)}-{Math.min((page + 1) * PRODUCTS_PER_PAGE, totalCount)} of {totalCount}
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
            Page {page + 1} of {Math.ceil(totalCount / PRODUCTS_PER_PAGE) || 1}
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

      {filteredProducts.length === 0 && (
        <div className="text-center rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', padding: '40px 20px' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No products available</p>
        </div>
      )}

      {/* Success Confirmation */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="rounded-3xl shadow-2xl text-center animate-scale-in"
            style={{
              backgroundColor: 'var(--background)',
              padding: '32px 24px',
              maxWidth: '340px',
              width: '100%',
              border: '3px solid var(--success)'
            }}
          >
            {/* Animated Success Icon with Pulse */}
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-scale"
              style={{
                backgroundColor: 'var(--success)',
                boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4), 0 10px 30px rgba(34, 197, 94, 0.3)'
              }}
            >
              <Check size={50} style={{ color: '#FFFFFF', strokeWidth: 3 }} />
            </div>

            {/* Success Message */}
            <h2
              className="mb-2"
              style={{
                color: 'var(--success)',
                fontSize: '26px',
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}
            >
              🎉 Sale Complete! 🎉
            </h2>

            {/* Total Amount - Large and Bold */}
            <div
              className="mb-4 py-4 px-6 rounded-xl"
              style={{
                backgroundColor: '#F0FDF4',
                border: '2px dashed var(--success)'
              }}
            >
              <p
                className="text-xs mb-1"
                style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                Total Amount
              </p>
              <p
                style={{
                  color: 'var(--success)',
                  fontSize: '36px',
                  fontWeight: '800',
                  lineHeight: '1',
                  letterSpacing: '-1px'
                }}
              >
                {Math.round(total)}
                <span style={{ fontSize: '18px', opacity: 0.8, marginLeft: '4px' }}>br</span>
              </p>
            </div>

            {/*励志提示 */}
            <p
              className="text-sm"
              style={{
                color: 'var(--text-secondary)',
                fontStyle: 'italic'
              }}
            >
              Great job! Keep up the excellent work! ✨
            </p>

            {/* Add animation styles */}
            <style>{`
              @keyframes scale-in {
                0% {
                  transform: scale(0.8);
                  opacity: 0;
                }
                50% {
                  transform: scale(1.05);
                }
                100% {
                  transform: scale(1);
                  opacity: 1;
                }
              }
              
              @keyframes pulse-scale {
                0%, 100% {
                  transform: scale(1);
                  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4), 0 10px 30px rgba(34, 197, 94, 0.3);
                }
                50% {
                  transform: scale(1.05);
                  box-shadow: 0 0 0 20px rgba(34, 197, 94, 0), 0 10px 40px rgba(34, 197, 94, 0.4);
                }
              }
              
              .animate-scale-in {
                animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
              }
              
              .animate-pulse-scale {
                animation: pulse-scale 1.5s ease-in-out infinite;
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Tier Upgrade Celebration */}
      {showTierUpgrade && (
        <TierUpgradeCelebration
          customerName={tierUpgradeData.customerName}
          oldTierName={tierUpgradeData.oldTierName}
          newTierName={tierUpgradeData.newTierName}
          newTierColor={tierUpgradeData.newTierColor}
          newTierIcon={tierUpgradeData.newTierIcon}
          discountPercentage={tierUpgradeData.discountPercentage}
          onClose={() => setShowTierUpgrade(false)}
        />
      )}
    </div>
  );
}