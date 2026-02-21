import { supabase } from './supabase/client';

/**
 * Fetches categories from existing products in the current branch
 * This ensures consistency across all components (Products, Sell, ProductForm, etc.)
 */
export const fetchCategories = async (branchId: string) => {
  if (!branchId) return [];
  
  try {
    const { data, error } = await supabase
      .from('menal_products')
      .select('category')
      .eq('branch_id', branchId)
      .not('category', 'is', null)
      .order('category');

    if (error) throw error;

    // Get unique categories and return sorted array
    const uniqueCategories = [...new Set(data.map(c => c.category))];
    return uniqueCategories.sort();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

/**
 * Adds a new category by creating a placeholder product
 * This maintains consistency with the existing category system
 */
export const addCategory = async (branchId: string, categoryName: string) => {
  if (!branchId || !categoryName.trim()) return { success: false, error: 'Invalid input' };

  try {
    // Check if category already exists
    const existingCategories = await fetchCategories(branchId);
    if (existingCategories.includes(categoryName.trim())) {
      return { success: false, error: 'Category already exists' };
    }

    // Create placeholder product to establish the category
    const placeholderId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error } = await supabase
      .from('menal_products')
      .insert({
        id: placeholderId,
        name: `[Category Placeholder] ${categoryName.trim()}`,
        category: categoryName.trim(),
        stock: 0,
        price: 0,
        min_stock: 0,
        notes: 'Placeholder product to establish category',
        branch_id: branchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Category already exists' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Add category error:', error);
    return { success: false, error: 'Failed to add category' };
  }
};
