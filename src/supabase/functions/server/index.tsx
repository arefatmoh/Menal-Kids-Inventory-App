import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

// Create Supabase client
const getSupabaseClient = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Helper function to generate IDs
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper function to map database fields to camelCase for frontend
const mapProductToFrontend = (product: any) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: product.price,
  stock: product.stock,
  minStock: product.min_stock,
  notes: product.notes,
  createdAt: product.created_at,
  updatedAt: product.updated_at,
});

// ========== PRODUCTS ROUTES ==========

// Get all products
app.get('/make-server-4d7424a8/products', async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('menal_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return c.json({
      success: true,
      data: (data || []).map(mapProductToFrontend)
    });
  } catch (error) {
    console.log('Error fetching products:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create product
app.post('/make-server-4d7424a8/products', async (c) => {
  try {
    const body = await c.req.json();
    const { name, category, price, stock, minStock, notes } = body;

    if (!name || !category || price === undefined || stock === undefined) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const id = generateId();
    const supabase = getSupabaseClient();

    const product = {
      id,
      name,
      category,
      price: parseFloat(price),
      stock: parseInt(stock),
      min_stock: minStock ? parseInt(minStock) : 0,
      notes: notes || '',
    };

    const { data, error } = await supabase
      .from('menal_products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'product_created',
      product_id: id,
      details: `Product "${name}" created with stock: ${stock}`,
      metadata: { stock, category, price, productName: name },
    });

    return c.json({ success: true, data: mapProductToFrontend(data) });
  } catch (error) {
    console.log('Error creating product:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update product
app.put('/make-server-4d7424a8/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const supabase = getSupabaseClient();

    const { data: existingProduct } = await supabase
      .from('menal_products')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingProduct) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    const updatedProduct = {
      name: body.name ?? existingProduct.name,
      category: body.category ?? existingProduct.category,
      price: body.price !== undefined ? parseFloat(body.price) : existingProduct.price,
      stock: body.stock !== undefined ? parseInt(body.stock) : existingProduct.stock,
      min_stock: body.minStock !== undefined ? parseInt(body.minStock) : existingProduct.min_stock,
      notes: body.notes ?? existingProduct.notes,
    };

    const { data, error } = await supabase
      .from('menal_products')
      .update(updatedProduct)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return c.json({ success: true, data: mapProductToFrontend(data) });
  } catch (error) {
    console.log('Error updating product:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete product
app.delete('/make-server-4d7424a8/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();

    const { data: product } = await supabase
      .from('menal_products')
      .select('*')
      .eq('id', id)
      .single();

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    const { error } = await supabase
      .from('menal_products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'product_deleted',
      product_id: id,
      details: `Product "${product.name}" deleted`,
      metadata: { ...product, productName: product.name },
    });

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting product:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Adjust stock (add or remove)
app.post('/make-server-4d7424a8/products/:id/adjust-stock', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { adjustment, reason } = body;
    const supabase = getSupabaseClient();

    const { data: product } = await supabase
      .from('menal_products')
      .select('*')
      .eq('id', id)
      .single();

    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }

    const newStock = product.stock + parseInt(adjustment);
    if (newStock < 0) {
      return c.json({ success: false, error: 'Insufficient stock' }, 400);
    }

    const { data, error } = await supabase
      .from('menal_products')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'stock_adjustment',
      product_id: id,
      details: `Stock ${adjustment > 0 ? 'added' : 'removed'}: ${Math.abs(adjustment)} units. Reason: ${reason || 'Manual adjustment'}`,
      metadata: { adjustment, newStock, reason, productName: product.name },
    });

    return c.json({ success: true, data: mapProductToFrontend(data) });
  } catch (error) {
    console.log('Error adjusting stock:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get low stock products
app.get('/make-server-4d7424a8/products/low-stock', async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('menal_products')
      .select('*')
      .gt('min_stock', 0)
      .filter('stock', 'lte', 'min_stock');

    if (error) throw error;

    return c.json({
      success: true,
      data: (data || []).map(mapProductToFrontend)
    });
  } catch (error) {
    console.log('Error fetching low stock products:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SALES ROUTES ==========

// Create sale
app.post('/make-server-4d7424a8/sales', async (c) => {
  try {
    const body = await c.req.json();
    const { items, paymentMethod, discount = 0 } = body;

    if (!items || items.length === 0) {
      return c.json({ success: false, error: 'No items in cart' }, 400);
    }

    const supabase = getSupabaseClient();

    // Validate stock and calculate total
    let total = 0;
    const saleItems = [];

    for (const item of items) {
      const { data: product } = await supabase
        .from('menal_products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (!product) {
        return c.json({ success: false, error: `Product ${item.productId} not found` }, 404);
      }

      if (product.stock < item.quantity) {
        return c.json({ success: false, error: `Insufficient stock for ${product.name}` }, 400);
      }

      const itemPrice = item.customPrice !== undefined ? parseFloat(item.customPrice) : product.price;
      const itemTotal = itemPrice * item.quantity;

      saleItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        price: itemPrice,
        original_price: product.price,
        total: itemTotal,
      });

      total += itemTotal;

      // Deduct stock
      await supabase
        .from('menal_products')
        .update({ stock: product.stock - item.quantity })
        .eq('id', product.id);
    }

    const finalTotal = total - parseFloat(discount);

    // Create sale record
    const saleId = generateId();
    const { data: sale, error: saleError } = await supabase
      .from('menal_sales')
      .insert({
        id: saleId,
        total,
        discount: parseFloat(discount),
        final_total: finalTotal,
        payment_method: paymentMethod,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Create sale items
    const saleItemsWithIds = saleItems.map(item => ({
      id: generateId(),
      sale_id: saleId,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from('menal_sale_items')
      .insert(saleItemsWithIds);

    if (itemsError) throw itemsError;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'sale',
      sale_id: saleId,
      details: `Sale completed: ${saleItems.length} item(s) - ${paymentMethod}`,
      metadata: { ...sale, items: saleItemsWithIds },
    });

    return c.json({
      success: true,
      data: {
        ...sale,
        items: saleItemsWithIds,
        reversed: false,
      }
    });
  } catch (error) {
    console.log('Error creating sale:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all sales
app.get('/make-server-4d7424a8/sales', async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data: sales, error } = await supabase
      .from('menal_sales')
      .select(`
        *,
        items:menal_sale_items(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return c.json({
      success: true,
      data: (sales || []).map(sale => ({
        ...sale,
        timestamp: sale.created_at,
      }))
    });
  } catch (error) {
    console.log('Error fetching sales:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Reverse sale
app.post('/make-server-4d7424a8/sales/:id/reverse', async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();

    const { data: sale } = await supabase
      .from('menal_sales')
      .select(`
        *,
        items:sale_items(*)
      `)
      .eq('id', id)
      .single();

    if (!sale) {
      return c.json({ success: false, error: 'Sale not found' }, 404);
    }

    if (sale.is_reversed) {
      return c.json({ success: false, error: 'Sale already reversed' }, 400);
    }

    // Return items to inventory
    for (const item of sale.items) {
      const { data: product } = await supabase
        .from('menal_products')
        .select('stock')
        .eq('id', item.product_id)
        .single();

      if (product) {
        await supabase
          .from('menal_products')
          .update({ stock: product.stock + item.quantity })
          .eq('id', item.product_id);
      }
    }

    // Mark sale as reversed
    const { data, error } = await supabase
      .from('menal_sales')
      .update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'sale_reversed',
      sale_id: id,
      details: `Sale reversed: ${sale.items.length} item(s) returned to inventory`,
      metadata: { ...data, items: sale.items },
    });

    return c.json({ success: true, data: { ...data, items: sale.items } });
  } catch (error) {
    console.log('Error reversing sale:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== EXPENSES ROUTES ==========

// Create expense
app.post('/make-server-4d7424a8/expenses', async (c) => {
  try {
    const body = await c.req.json();
    const { name, category, amount, notes, date } = body;

    if (!name || !amount) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const id = generateId();
    const supabase = getSupabaseClient();

    const expense = {
      id,
      name,
      category: category || 'Other',
      amount: parseFloat(amount),
      notes: notes || '',
      date: date || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('menal_expenses')
      .insert(expense)
      .select()
      .single();

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'expense',
      expense_id: id,
      details: `Expense: ${name} - ${amount} Birr`,
      metadata: expense,
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.log('Error creating expense:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all expenses
app.get('/make-server-4d7424a8/expenses', async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('menal_expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    return c.json({ success: true, data: data || [] });
  } catch (error) {
    console.log('Error fetching expenses:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete expense
app.delete('/make-server-4d7424a8/expenses/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();

    const { data: expense } = await supabase
      .from('menal_expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (!expense) {
      return c.json({ success: false, error: 'Expense not found' }, 404);
    }

    const { error } = await supabase
      .from('menal_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Create activity log entry
    const historyId = generateId();
    await supabase.from('menal_activity_log').insert({
      id: historyId,
      type: 'expense_deleted',
      expense_id: id,
      details: `Expense deleted: ${expense.name}`,
      metadata: expense,
    });

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting expense:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== HISTORY ROUTES ==========

// Get history
app.get('/make-server-4d7424a8/history', async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('menal_activity_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to match old format
    const history = (data || []).map(log => ({
      id: log.id,
      type: log.type,
      details: log.details,
      timestamp: log.created_at,
      productId: log.product_id,
      saleId: log.sale_id,
      expenseId: log.expense_id,
      productName: log.metadata?.productName,
      metadata: log.metadata,
    }));

    return c.json({ success: true, data: history });
  } catch (error) {
    console.log('Error fetching history:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== DASHBOARD ROUTES ==========

// Get dashboard summary
app.get('/make-server-4d7424a8/dashboard/summary', async (c) => {
  try {
    const { startDate, endDate } = c.req.query();
    const supabase = getSupabaseClient();

    // Build date filter
    let salesQuery = supabase
      .from('menal_sales')
      .select(`
        *,
        items:sale_items(*)
      `)
      .eq('is_reversed', false);

    let expensesQuery = supabase
      .from('menal_expenses')
      .select('*');

    if (startDate) {
      salesQuery = salesQuery.gte('created_at', startDate);
      expensesQuery = expensesQuery.gte('date', startDate);
    }

    if (endDate) {
      salesQuery = salesQuery.lte('created_at', endDate);
      expensesQuery = expensesQuery.lte('date', endDate);
    }

    const [
      { data: sales },
      { data: expenses },
      { data: products },
    ] = await Promise.all([
      salesQuery,
      expensesQuery,
      supabase.from('menal_products').select('*'),
    ]);

    // Calculate metrics
    const totalSales = (sales || []).reduce((sum, s) => sum + parseFloat(s.final_total), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const salesCount = (sales || []).length;

    // Payment method breakdown
    const paymentBreakdown = {
      cash: 0,
      bank: 0,
      telebirr: 0,
    };

    (sales || []).forEach(s => {
      const method = s.payment_method.toLowerCase();
      if (method === 'cash') paymentBreakdown.cash += parseFloat(s.final_total);
      else if (method === 'bank transfer' || method === 'bank') paymentBreakdown.bank += parseFloat(s.final_total);
      else if (method === 'telebirr') paymentBreakdown.telebirr += parseFloat(s.final_total);
    });

    // Product sales breakdown
    const productSales: any = {};
    (sales || []).forEach(s => {
      (s.items || []).forEach((item: any) => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.product_id].quantity += item.quantity;
        productSales[item.product_id].revenue += parseFloat(item.total);
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]: any) => ({ id, ...data }))
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 5);

    // Stock value
    const stockValue = (products || []).reduce((sum, p) => sum + (p.stock * parseFloat(p.price)), 0);

    // Low stock count
    const lowStockCount = (products || []).filter(p => p.stock <= p.min_stock && p.min_stock > 0).length;

    return c.json({
      success: true,
      data: {
        totalSales,
        totalExpenses,
        salesCount,
        netProfit: totalSales - totalExpenses,
        paymentBreakdown,
        topProducts,
        stockValue,
        lowStockCount,
        productCount: (products || []).length,
      },
    });
  } catch (error) {
    console.log('Error fetching dashboard summary:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);