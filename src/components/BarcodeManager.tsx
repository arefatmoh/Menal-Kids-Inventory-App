import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, Printer, RefreshCw, Check, Barcode, Package, Layers, Table2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import { assignMissingBarcodes } from '../utils/barcode';
import { LoadingSpinner } from './LoadingSpinner';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  barcode: string | null;
}

interface BarcodeManagerProps {
  onBack: () => void;
}

// Component to render a single barcode SVG
function BarcodeImage({ value, width = 1.5, height = 40, fontSize = 12 }: { value: string; width?: number; height?: number; fontSize?: number }) {
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
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [value, width, height, fontSize]);

  return <svg ref={svgRef} />;
}

export function BarcodeManager({ onBack }: BarcodeManagerProps) {
  const { currentBranchId } = useBranch();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async () => {
    if (!currentBranchId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('menal_products')
        .select('id, name, category, price, stock, barcode')
        .eq('branch_id', currentBranchId)
        .not('name', 'like', '[Category Placeholder]%')
        .order('barcode', { ascending: true, nullsFirst: false });

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleAssignMissing = async () => {
    if (!currentBranchId) return;
    setAssigning(true);
    try {
      const count = await assignMissingBarcodes(currentBranchId);
      if (count > 0) {
        toast.success(`Assigned barcodes to ${count} product${count > 1 ? 's' : ''}!`);
        fetchProducts();
      } else {
        toast.info('All products already have barcodes');
      }
    } catch (error) {
      console.error('Error assigning barcodes:', error);
      toast.error('Failed to assign barcodes');
    } finally {
      setAssigning(false);
    }
  };

  const toggleSelect = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const withBarcodes = filteredProducts.filter(p => p.barcode);
    if (selectedProducts.size === withBarcodes.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(withBarcodes.map(p => p.id)));
    }
  };

  const productsWithMissingBarcodes = products.filter(p => !p.barcode).length;
  const productsToPrint = products.filter(p => selectedProducts.has(p.id) && p.barcode);

  // Shared print window helper — takes an array of barcode strings to print
  const openPrintWindow = (barcodes: string[], infoText: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups.');
      return;
    }

    const labelsHtml = barcodes.map(code => `
      <div class="label">
        <svg class="barcode" data-value="${code}"></svg>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Menal Kids - Barcode Labels</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }

          @page {
            size: A4;
            margin: 2mm;
          }

          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #fff;
          }

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
            flex-direction: column;
            align-items: center;
            justify-content: center;
            page-break-inside: avoid;
            min-height: 16mm;
          }

          .label svg {
            max-width: 100%;
            height: auto;
          }

          @media print {
            body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
            .label { border-color: #ddd; }
            .no-print { display: none !important; }
          }

          .no-print {
            text-align: center;
            padding: 16px;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
          }
          .no-print button {
            padding: 10px 24px;
            background: #714329;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            margin: 0 8px;
          }
          .no-print button:hover { opacity: 0.9; }
          .no-print .info { font-size: 13px; color: #666; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print Labels</button>
          <button onclick="window.close()" style="background:#888">Close</button>
          <div class="info">${infoText}</div>
        </div>
        <div class="grid">
          ${labelsHtml}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script>
          document.querySelectorAll('.barcode').forEach(function(svg) {
            var value = svg.getAttribute('data-value');
            if (value) {
              JsBarcode(svg, value, {
                format: 'CODE128',
                width: 1.2,
                height: 28,
                displayValue: true,
                fontSize: 10,
                margin: 0,
                background: 'transparent',
                lineColor: '#000000',
                textMargin: 0
              });
            }
          });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print 1 label per selected product
  const handlePrint = () => {
    if (productsToPrint.length === 0) {
      toast.error('Select products with barcodes to print');
      return;
    }
    const barcodes = productsToPrint.map(p => p.barcode!);
    openPrintWindow(barcodes, `${barcodes.length} barcode labels • 5 per row`);
  };

  // Print N labels per product where N = stock count
  const handlePrintByStock = () => {
    if (productsToPrint.length === 0) {
      toast.error('Select products with barcodes to print');
      return;
    }
    const barcodes: string[] = [];
    for (const p of productsToPrint) {
      const count = Math.max(1, p.stock); // at least 1
      for (let i = 0; i < count; i++) {
        barcodes.push(p.barcode!);
      }
    }
    openPrintWindow(
      barcodes,
      `${barcodes.length} total labels (${productsToPrint.length} products × stock qty) • 5 per row`
    );
  };

  // Print a table with product name, barcode, and stock
  const handlePrintTable = () => {
    if (productsToPrint.length === 0) {
      toast.error('Select products with barcodes to print');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups.');
      return;
    }

    const rows = productsToPrint.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td style="font-family:monospace;font-weight:600;text-align:center">${p.barcode}</td>
        <td style="text-align:center">${p.stock}</td>
      </tr>
    `).join('');

    const totalStock = productsToPrint.reduce((sum, p) => sum + p.stock, 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Menal Kids - Product Barcode List</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; padding: 10px; }
          h2 { text-align: center; margin-bottom: 4px; font-size: 16px; color: #333; }
          .subtitle { text-align: center; font-size: 12px; color: #888; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #714329; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
          th:nth-child(1) { width: 40px; text-align: center; }
          th:nth-child(3) { text-align: center; }
          th:nth-child(4) { text-align: center; width: 70px; }
          td { padding: 6px 10px; border-bottom: 1px solid #eee; }
          td:first-child { text-align: center; color: #999; }
          tr:hover { background: #faf8f6; }
          .footer { margin-top: 12px; text-align: right; font-size: 12px; color: #666; padding-right: 10px; }
          @media print {
            body { -webkit-print-color-adjust: exact; padding: 0; }
            .no-print { display: none !important; }
            tr:hover { background: transparent; }
          }
          .no-print { text-align: center; padding: 16px; background: #f5f5f5; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
          .no-print button { padding: 10px 24px; background: #714329; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; margin: 0 8px; }
          .no-print button:hover { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">\uD83D\uDDA8\uFE0F Print Table</button>
          <button onclick="window.close()" style="background:#888">Close</button>
        </div>
        <h2>Menal Kids — Product Inventory</h2>
        <div class="subtitle">${productsToPrint.length} products • Total stock: ${totalStock}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>Barcode</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="footer">Total: ${productsToPrint.length} products &bull; ${totalStock} units</div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export selected products as Excel (.xlsx) — handles Amharic correctly
  const handleExportExcel = () => {
    if (productsToPrint.length === 0) {
      toast.error('Select products with barcodes to export');
      return;
    }

    const rows = productsToPrint.map((p, i) => ({
      '#': i + 1,
      'Product Name': p.name,
      'Barcode': p.barcode,
      'Stock': p.stock,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 35 },  // Product Name
      { wch: 12 },  // Barcode
      { wch: 8 },   // Stock
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `menal_kids_products_${date}.xlsx`);
    toast.success(`Exported ${productsToPrint.length} products to Excel`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading barcodes..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
        <button
          onClick={onBack}
          className="p-2 rounded-lg transition-all active:scale-95"
          style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Barcode Manager</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
            {products.length} products • {products.filter(p => p.barcode).length} with barcodes
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div
        className="rounded-xl shadow-sm border"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
          padding: '12px',
          marginBottom: '12px',
        }}
      >
        {/* Search */}
        <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm rounded border-none outline-none"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {productsWithMissingBarcodes > 0 && (
            <button
              onClick={handleAssignMissing}
              disabled={assigning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
              style={{
                backgroundColor: 'var(--success)',
                color: '#FFFFFF',
                border: 'none',
                opacity: assigning ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} className={assigning ? 'animate-spin' : ''} />
              Assign ({productsWithMissingBarcodes})
            </button>
          )}

          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
            style={{
              backgroundColor: selectedProducts.size > 0 ? 'var(--primary)' : 'var(--gray-light)',
              color: selectedProducts.size > 0 ? '#FFFFFF' : 'var(--text-primary)',
              border: `1px solid ${selectedProducts.size > 0 ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            <Check size={14} />
            {selectedProducts.size > 0 ? `Selected (${selectedProducts.size})` : 'Select All'}
          </button>

          <button
            onClick={handlePrint}
            disabled={selectedProducts.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
            style={{
              backgroundColor: selectedProducts.size > 0 ? 'var(--primary)' : 'var(--gray-light)',
              color: selectedProducts.size > 0 ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${selectedProducts.size > 0 ? 'var(--primary)' : 'var(--border)'}`,
              opacity: selectedProducts.size === 0 ? 0.5 : 1,
            }}
          >
            <Printer size={14} />
            Print
          </button>

          <button
            onClick={handlePrintByStock}
            disabled={selectedProducts.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
            style={{
              backgroundColor: selectedProducts.size > 0 ? 'var(--success)' : 'var(--gray-light)',
              color: selectedProducts.size > 0 ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${selectedProducts.size > 0 ? 'var(--success)' : 'var(--border)'}`,
              opacity: selectedProducts.size === 0 ? 0.5 : 1,
            }}
          >
            <Layers size={14} />
            Print by Stock
          </button>

          <button
            onClick={handlePrintTable}
            disabled={selectedProducts.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
            style={{
              backgroundColor: selectedProducts.size > 0 ? '#4F46E5' : 'var(--gray-light)',
              color: selectedProducts.size > 0 ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${selectedProducts.size > 0 ? '#4F46E5' : 'var(--border)'}`,
              opacity: selectedProducts.size === 0 ? 0.5 : 1,
            }}
          >
            <Table2 size={14} />
            Print Table
          </button>

          <button
            onClick={handleExportExcel}
            disabled={selectedProducts.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 text-xs"
            style={{
              backgroundColor: selectedProducts.size > 0 ? '#0D9488' : 'var(--gray-light)',
              color: selectedProducts.size > 0 ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${selectedProducts.size > 0 ? '#0D9488' : 'var(--border)'}`,
              opacity: selectedProducts.size === 0 ? 0.5 : 1,
            }}
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div
          className="text-center rounded-xl shadow-sm border"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            padding: '48px 24px',
          }}
        >
          <Barcode size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-primary)' }}>No products found</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {searchQuery ? 'Try adjusting your search' : 'Add products to get started'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredProducts.map((product) => {
            const isSelected = selectedProducts.has(product.id);
            const hasBarcode = !!product.barcode;

            return (
              <div
                key={product.id}
                onClick={() => hasBarcode && toggleSelect(product.id)}
                className="rounded-xl shadow-sm border transition-all cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'rgba(113, 67, 41, 0.05)' : 'var(--background)',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  borderWidth: isSelected ? '2px' : '1px',
                  padding: isSelected ? '11px 15px' : '12px 16px',
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Selection Checkbox */}
                  <div
                    className="flex items-center justify-center rounded-md transition-all flex-shrink-0"
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--gray-light)',
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    {isSelected && <Check size={14} color="#FFFFFF" />}
                  </div>

                  {/* Product Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      className="text-sm"
                      style={{
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {product.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {product.category} • {Math.round(product.price)} br
                    </p>
                  </div>

                  {/* Barcode */}
                  <div className="flex-shrink-0" style={{ textAlign: 'right' }}>
                    {hasBarcode ? (
                      <div>
                        <BarcodeImage value={product.barcode!} width={1} height={28} fontSize={10} />
                      </div>
                    ) : (
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                        }}
                      >
                        No barcode
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden print area */}
      <div ref={printRef} style={{ display: 'none' }} />
    </div>
  );
}
