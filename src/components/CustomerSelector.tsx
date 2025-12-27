import { useState, useEffect, useRef } from 'react';
import { User, Phone, X, ChevronDown, ChevronUp, Crown, Award, Medal, Gem, Star, Tag as TagIcon } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string;
  total_purchases: number;
  total_visits: number;
  tier_name?: string;
  tier_icon?: string;
  tier_color?: string;
  tags?: any[];
}

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
  customerName: string;
  customerPhone: string;
  onCustomerNameChange: (name: string) => void;
  onCustomerPhoneChange: (phone: string) => void;
}

export function CustomerSelector({
  selectedCustomer,
  onCustomerSelect,
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange
}: CustomerSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter customers based on name input
  useEffect(() => {
    if (customerName.trim() === '') {
      setFilteredCustomers([]);
    } else {
      const query = customerName.toLowerCase();
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query)
      );
      setFilteredCustomers(filtered);
    }
  }, [customerName, customers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('menal_customers_with_segments')
        .select('*')
        .order('total_purchases', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    onCustomerSelect(customer);
    onCustomerNameChange(customer.name);
    onCustomerPhoneChange(customer.phone);
    setIsExpanded(false);
  };

  const handleClearCustomer = () => {
    onCustomerSelect(null);
    onCustomerNameChange('');
    onCustomerPhoneChange('');
    setIsExpanded(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Selected Customer Display or Collapsed Button */}
      {selectedCustomer ? (
        <div
          className="rounded-xl border flex items-center justify-between"
          style={{
            backgroundColor: 'var(--secondary)',
            borderColor: 'var(--primary)',
            padding: '12px 14px',
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <User size={18} style={{ color: '#FFFFFF' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>
                {selectedCustomer.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {selectedCustomer.phone}
                {selectedCustomer.total_visits > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    • {selectedCustomer.total_visits} {selectedCustomer.total_visits === 1 ? 'visit' : 'visits'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClearCustomer}
            className="p-1.5 rounded-lg transition-all ml-2"
            style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>
      ) : !isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full rounded-xl border flex items-center justify-between transition-all"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            padding: '12px 14px',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--gray-light)',
                flexShrink: 0,
              }}
            >
              <User size={18} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Add Customer (Optional)
            </span>
          </div>
          <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      ) : (
        <div
          className="rounded-xl border"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--primary)',
            padding: '12px 14px',
          }}
        >
          {/* Header with collapse button */}
          <div
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => setIsExpanded(false)}
          >
            <div className="flex items-center gap-2">
              <User size={16} style={{ color: 'var(--primary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Customer Info
              </span>
            </div>
            <ChevronUp size={18} style={{ color: 'var(--primary)' }} />
          </div>

          {/* Input Fields */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Name Input */}
            <div className="relative">
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                placeholder="Customer name"
                className="w-full outline-none text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  paddingLeft: '24px',
                }}
              />
            </div>

            {/* Phone Input */}
            <div className="relative">
              <Phone
                size={16}
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => onCustomerPhoneChange(e.target.value)}
                placeholder="Phone number"
                className="w-full outline-none text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  paddingLeft: '24px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isExpanded && !selectedCustomer && filteredCustomers.length > 0 && (
        <div
          className="absolute z-50 w-full rounded-xl shadow-2xl border mt-2"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleSelectCustomer(customer)}
              className="w-full flex items-center gap-3 transition-all hover:bg-opacity-80"
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                textAlign: 'left',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'var(--secondary)',
                  flexShrink: 0,
                }}
              >
                <User size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                  {customer.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {customer.phone}
                  {customer.total_visits > 0 && (
                    <span style={{ marginLeft: '6px', opacity: 0.8 }}>
                      • {customer.total_visits} {customer.total_visits === 1 ? 'visit' : 'visits'}
                    </span>
                  )}
                </p>
              </div>
              {customer.total_purchases > 0 && (
                <div className="text-xs" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                  {customer.total_purchases.toFixed(0)} br
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}