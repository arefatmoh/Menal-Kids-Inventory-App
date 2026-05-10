import { supabase } from './supabase/client';

/**
 * Generate the next sequential barcode for a given branch.
 * Barcodes are 5-digit zero-padded numbers, unique per branch.
 */
export async function generateNextBarcode(branchId: string): Promise<string> {
  try {
    // Get the highest existing barcode for this branch
    const { data, error } = await supabase
      .from('menal_products')
      .select('barcode')
      .eq('branch_id', branchId)
      .not('barcode', 'is', null)
      .order('barcode', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching max barcode:', error);
      // Fallback: use timestamp-based barcode
      return String(Date.now()).slice(-5);
    }

    let nextNumber = 1;

    if (data && data.length > 0 && data[0].barcode) {
      const maxBarcode = parseInt(data[0].barcode, 10);
      if (!isNaN(maxBarcode)) {
        nextNumber = maxBarcode + 1;
      }
    }

    // Pad to 5 digits
    return String(nextNumber).padStart(5, '0');
  } catch (err) {
    console.error('Error generating barcode:', err);
    return String(Date.now()).slice(-5);
  }
}

/**
 * Look up a product by its barcode within a specific branch.
 */
export async function findProductByBarcode(branchId: string, barcode: string) {
  const paddedBarcode = barcode.padStart(5, '0');
  
  const { data, error } = await supabase
    .from('menal_products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('barcode', paddedBarcode)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Assign barcodes to all products that don't have one yet in a given branch.
 * Returns the number of products updated.
 */
export async function assignMissingBarcodes(branchId: string): Promise<number> {
  // Get current max barcode
  const { data: maxData } = await supabase
    .from('menal_products')
    .select('barcode')
    .eq('branch_id', branchId)
    .not('barcode', 'is', null)
    .order('barcode', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (maxData && maxData.length > 0 && maxData[0].barcode) {
    const max = parseInt(maxData[0].barcode, 10);
    if (!isNaN(max)) {
      nextNumber = max + 1;
    }
  }

  // Get all products without barcodes
  const { data: products, error } = await supabase
    .from('menal_products')
    .select('id')
    .eq('branch_id', branchId)
    .is('barcode', null)
    .order('created_at', { ascending: true });

  if (error || !products || products.length === 0) {
    return 0;
  }

  // Assign barcodes one by one
  let updated = 0;
  for (const product of products) {
    const barcode = String(nextNumber).padStart(5, '0');
    const { error: updateError } = await supabase
      .from('menal_products')
      .update({ barcode })
      .eq('id', product.id);

    if (!updateError) {
      updated++;
      nextNumber++;
    }
  }

  return updated;
}
