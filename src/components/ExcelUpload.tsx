import React, { useState } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ProductData {
  name: string;
  category: string;
  quantity: number;
}

export function ExcelUpload() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState<string>('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('Please upload an Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let parsedProducts: ProductData[] = [];
        
        if (file.name.endsWith('.csv')) {
          // Handle CSV files
          if (typeof data === 'string') {
            const lines = data.split('\n').filter(line => line.trim());
            const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              const parts = line.split(/\t|,/);
              if (parts.length >= 3) {
                const name = parts[0].trim();
                const category = parts[1].trim();
                const quantity = parseInt(parts[2].trim()) || 0;
                
                if (name && category && quantity > 0) {
                  parsedProducts.push({ name, category, quantity });
                }
              }
            }
          }
        } else {
          // Handle Excel files (.xlsx, .xls)
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length > 0) {
            // Check if first row is headers
            const firstRow = jsonData[0];
            const startIndex = firstRow.some((cell: any) => 
              typeof cell === 'string' && cell.toLowerCase().includes('name')
            ) ? 1 : 0;
            
            for (let i = startIndex; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (row.length >= 3) {
                const name = String(row[0] || '').trim();
                const category = String(row[1] || '').trim();
                const quantity = parseInt(row[2]) || 0;
                
                if (name && category && quantity > 0) {
                  parsedProducts.push({ name, category, quantity });
                }
              }
            }
          }
        }
        
        setProducts(parsedProducts);
        toast.success(`Successfully parsed ${parsedProducts.length} products`);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Error parsing file. Please check the format and try again.');
      } finally {
        setIsProcessing(false);
      }
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const generateSQL = () => {
    if (products.length === 0) {
      toast.error('No products to generate SQL for');
      return;
    }

    const sqlStatements = products.map((product, index) => {
      const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
      return `INSERT INTO menal_products (id, name, category, stock, price, min_stock, notes, branch_id, created_at, updated_at) 
VALUES ('${id}', '${product.name.replace(/'/g, "''")}', '${product.category.replace(/'/g, "''")}', ${product.quantity}, 0, 0, '', 'ce4ebf94-0c66-4ff0-ba35-b18515f9b489', NOW(), NOW());`;
    });

    const fullSQL = `-- SQL for adding products to MebratHayl branch (ID: ce4ebf94-0c66-4ff0-ba35-b18515f9b489)
-- Generated on ${new Date().toLocaleString()}
-- Total products: ${products.length}

${sqlStatements.join('\n\n')}

-- Verification query (optional):
-- SELECT COUNT(*) as total_products FROM menal_products WHERE name IN (${products.map(p => `'${p.name.replace(/'/g, "''")}'`).join(', ')});`;

    setGeneratedSQL(fullSQL);
    toast.success('SQL generated successfully!');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedSQL).then(() => {
      toast.success('SQL copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const downloadSQL = () => {
    const blob = new Blob([generatedSQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menal_products_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('SQL file downloaded!');
  };

  const clearData = () => {
    setProducts([]);
    setGeneratedSQL('');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Excel to SQL Generator</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Upload an Excel file to generate SQL for adding products to MebratHayl branch
        </p>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: 'var(--gray-light)',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid var(--border)'
      }}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '12px' }}>
          <AlertCircle size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Instructions
        </h3>
        <ol style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px' }}>
          <li>Prepare your Excel file with 3 columns: <strong>name</strong>, <strong>category</strong>, <strong>quantity</strong></li>
          <li>Save the file as CSV (.csv) or Excel (.xlsx, .xls)</li>
          <li>Upload the file using the button below</li>
          <li>Review the parsed products and generate SQL</li>
          <li>Copy or download the generated SQL to run in your database</li>
        </ol>
        
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--background)', borderRadius: '6px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Category Guidelines:</strong>
          <ul style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Use consistent category names (e.g., "የታች ልብስ", "የላይ ልብስ", "ኩልታ", "ጫማ")</li>
            <li>Avoid special characters in category names</li>
            <li>Keep category names short but descriptive</li>
            <li>Use the same language (Amharic/English) consistently</li>
          </ul>
        </div>
      </div>

      {/* File Upload */}
      <div style={{
        border: '2px dashed var(--border)',
        borderRadius: '8px',
        padding: '32px',
        textAlign: 'center',
        marginBottom: '24px',
        backgroundColor: 'var(--gray-light)'
      }}>
        <input
          id="file-upload"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <label
          htmlFor="file-upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: 'var(--primary)',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Upload size={20} />
          {isProcessing ? 'Processing...' : 'Choose Excel File'}
        </label>
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px', margin: '12px 0 0 0' }}>
          Supported formats: .xlsx, .xls, .csv
        </p>
      </div>

      {/* Products Preview */}
      {products.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>
              <CheckCircle size={16} style={{ display: 'inline', marginRight: '8px', color: 'var(--success)' }} />
              Parsed Products ({products.length})
            </h3>
            <button
              onClick={clearData}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--danger)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear
            </button>
          </div>
          
          <div style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--gray-light)', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{product.name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{product.category}</td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{product.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={generateSQL}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={20} />
            Generate SQL
          </button>
        </div>
      )}

      {/* Generated SQL */}
      {generatedSQL && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Generated SQL</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={16} />
                Copy
              </button>
              <button
                onClick={downloadSQL}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            <pre style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '14px',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {generatedSQL}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
