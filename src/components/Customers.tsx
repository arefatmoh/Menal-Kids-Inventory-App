import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Crown,
  Award,
  Medal,
  Gem,
  Star,
  Repeat,
  Sparkles,
  AlertCircle,
  Tag as TagIcon,
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  X,
  Plus,
  Minus,
  Target,
  DollarSign
} from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { useBranch } from '../context/BranchContext';

interface CustomerSegment {
  customer_id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  total_purchases: number;
  total_visits: number;
  last_visit_date: string | null;
  tier_id: string | null;
  tier_name: string | null;
  tier_icon: string | null;
  tier_color: string | null;
  discount_percentage: number | null;
  tags: any[] | null;
  clv?: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface TierDistribution {
  tier_name: string;
  customer_count: number;
  total_revenue: number;
  tier_color: string;
  tier_icon: string;
}

export function Customers() {
  const { currentBranchId } = useBranch();
  const [customers, setCustomers] = useState<CustomerSegment[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSegment | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newCustomersThisMonth: 0,
    tierUpgradesThisMonth: 0,
    totalRevenue: 0,
  });



  useEffect(() => {
    if (currentBranchId) {
      setPage(0);
      const timer = setTimeout(() => {
        fetchCustomersWithSegments(0, searchQuery, selectedTier);
      }, 300);
      fetchAvailableTags();
      fetchInsights();
      return () => clearTimeout(timer);
    }
  }, [currentBranchId, searchQuery, selectedTier]);

  const handleNextPage = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCustomersWithSegments(nextPage, searchQuery, selectedTier);
  };

  const handlePrevPage = () => {
    const prevPage = Math.max(0, page - 1);
    setPage(prevPage);
    fetchCustomersWithSegments(prevPage, searchQuery, selectedTier);
  };

  /* 
    Removed client-side filterCustomers useEffect as it's now handled server-side 
  */

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const CUSTOMERS_PER_PAGE = 20;

  const fetchCustomersWithSegments = async (pageNumber = 0, currentSearch = searchQuery, currentTier = selectedTier) => {
    setLoading(true);
    try {
      let query = supabase
        .from('menal_customer_segments_view')
        .select('*', { count: 'exact' })
        .eq('branch_id', currentBranchId)
        .order('total_purchases', { ascending: false });

      if (currentSearch) {
        // Simple search on customer name or phone
        // .or(`customer_name.ilike.%${currentSearch}%,phone.ilike.%${currentSearch}%`)
        query = query.or(`customer_name.ilike.%${currentSearch}%,phone.ilike.%${currentSearch}%`);
      }

      if (currentTier) {
        query = query.eq('tier_id', currentTier);
      }

      // Pagination
      const from = pageNumber * CUSTOMERS_PER_PAGE;
      const to = from + CUSTOMERS_PER_PAGE - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      // Fetch CLV for each customer
      const customersWithCLV = await Promise.all(
        (data || []).map(async (customer) => {
          const { data: clvData } = await supabase
            .rpc('menal_calculate_customer_clv', { customer_uuid: customer.customer_id });

          return {
            ...customer,
            clv: clvData || 0,
          };
        })
      );

      if (customersWithCLV.length < CUSTOMERS_PER_PAGE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setCustomers(customersWithCLV);
      setTotalCount(count || 0);
      // We don't need filteredCustomers separate state anymore as we filter server-side
      setFilteredCustomers(customersWithCLV);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('menal_customer_tags')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      // Fetch tier distribution
      const { data: tierData } = await supabase
        .from('menal_customers_with_segments')
        .select('tier_name, tier_color, tier_icon, total_purchases')
        .eq('branch_id', currentBranchId);

      if (tierData) {
        const tierGroups = tierData.reduce((acc: any, customer) => {
          const tierName = customer.tier_name || 'No Tier';
          if (!acc[tierName]) {
            acc[tierName] = {
              tier_name: tierName,
              customer_count: 0,
              total_revenue: 0,
              tier_color: customer.tier_color || '#999999',
              tier_icon: customer.tier_icon || 'medal',
            };
          }
          acc[tierName].customer_count += 1;
          acc[tierName].total_revenue += customer.total_purchases || 0;
          return acc;
        }, {});

        setTierDistribution(Object.values(tierGroups));
      }

      // Calculate stats
      const { count: totalCount } = await supabase
        .from('menal_customers')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranchId);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: newCount } = await supabase
        .from('menal_customers')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', currentBranchId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: upgradeCount } = await supabase
        .from('menal_customer_tier_history')
        .select('*', { count: 'exact', head: true })
        .gte('changed_at', thirtyDaysAgo.toISOString());

      // Calculate total revenue
      const { data: salesData } = await supabase
        .from('menal_sales')
        .select('final_total')
        .eq('branch_id', currentBranchId)
        .eq('is_reversed', false);

      const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.final_total || 0), 0) || 0;

      setStats({
        totalCustomers: totalCount || 0,
        newCustomersThisMonth: newCount || 0,
        tierUpgradesThisMonth: upgradeCount || 0,
        totalRevenue,
      });

    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  };

  const getIconComponent = (iconName: string | null, size = 16) => {
    if (!iconName) return null;
    const icons: { [key: string]: any } = {
      crown: Crown,
      award: Award,
      medal: Medal,
      gem: Gem,
      star: Star,
      repeat: Repeat,
      sparkles: Sparkles,
      'alert-circle': AlertCircle,
    };
    const IconComponent = icons[iconName] || Crown;
    return <IconComponent size={size} />;
  };

  const getTierIcon = (iconName: string) => {
    const icons: any = {
      crown: Crown,
      award: Award,
      medal: Medal,
      gem: Gem,
    };
    return icons[iconName] || Medal;
  };

  const handleTagToggle = async (customerId: string, tagId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Remove tag
        const { error } = await supabase
          .from('menal_customer_tag_assignments')
          .delete()
          .eq('customer_id', customerId)
          .eq('tag_id', tagId);

        if (error) throw error;
        toast.success('Tag removed');
      } else {
        // Add tag
        const { error } = await supabase
          .from('menal_customer_tag_assignments')
          .insert({
            customer_id: customerId,
            tag_id: tagId,
          });

        if (error) throw error;
        toast.success('Tag assigned');
      }

      // Refresh customers
      fetchCustomersWithSegments();
    } catch (error: any) {
      console.error('Error toggling tag:', error);
      if (error.code === '23505') {
        toast.error('Tag already assigned');
      } else {
        toast.error('Failed to update tag');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div
            className="inline-block rounded-full animate-spin"
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--gray-light)',
              borderTop: '3px solid var(--primary)'
            }}
          />
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            Loading customers...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--primary)',
          }}
        >
          <Users size={20} style={{ color: '#FFFFFF' }} />
        </div>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '2px' }}>Customers</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Manage your customer base
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            backgroundColor: 'var(--gray-light)',
            borderRadius: '12px',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Total Customers
            </span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', margin: 0 }}>
            {stats.totalCustomers}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--success)', margin: 0 }}>
            +{stats.newCustomersThisMonth} this month
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--gray-light)',
            borderRadius: '12px',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <DollarSign size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Total Revenue
            </span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', margin: 0 }}>
            {stats.totalRevenue.toLocaleString()} br
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
            All time
          </p>
        </div>
      </div>

      {/* Tier Distribution */}
      {tierDistribution.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--gray-light)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Tier Distribution
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {tierDistribution.length} tiers
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tierDistribution.map((tier) => {
              const Icon = getTierIcon(tier.tier_icon);
              const percentage = stats.totalCustomers > 0
                ? ((tier.customer_count / stats.totalCustomers) * 100).toFixed(0)
                : 0;

              return (
                <div key={tier.tier_name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} style={{ color: tier.tier_color }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {tier.tier_name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {tier.customer_count} customers
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: tier.tier_color }}>
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--background)',
                      marginBottom: '8px'
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor: tier.tier_color,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Total Revenue
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {tier.total_revenue.toLocaleString()} br
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Search with integrated filter icon */}
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            style={{
              width: '100%',
              borderRadius: '12px',
              border: 'none',
              outline: 'none',
              backgroundColor: 'var(--gray-light)',
              color: 'var(--text-primary)',
              padding: '14px 52px 14px 48px',
            }}
          />
          {/* Filter icon inside search bar */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="transition-all active:scale-95"
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showFilters ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '4px',
            }}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div
            style={{
              backgroundColor: 'var(--gray-light)',
              borderRadius: '12px',
              padding: '16px'
            }}
          >
            <p style={{ fontSize: '0.75rem', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              Filter by Tier
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                onClick={() => setSelectedTier(null)}
                className="transition-all"
                style={{
                  borderRadius: '20px',
                  padding: '8px 16px',
                  fontSize: '0.875rem',
                  backgroundColor: !selectedTier ? 'var(--primary)' : 'var(--background)',
                  color: !selectedTier ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                All
              </button>
              {Array.from(new Set(customers.map(c => c.tier_name).filter(Boolean))).map((tierName) => {
                const tier = customers.find(c => c.tier_name === tierName);
                if (!tier) return null;
                const isSelected = selectedTier === tier.tier_id;
                return (
                  <button
                    key={tier.tier_id}
                    onClick={() => setSelectedTier(isSelected ? null : tier.tier_id)}
                    className="transition-all"
                    style={{
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: isSelected ? (tier.tier_color || 'var(--primary)') : 'var(--background)',
                      color: isSelected ? '#FFFFFF' : (tier.tier_color || 'var(--text-primary)'),
                    }}
                  >
                    {tier.tier_icon && getIconComponent(tier.tier_icon, 14)}
                    <span>{tierName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customer List Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
          All Customers ({filteredCustomers.length})
        </h3>
      </div>

      {/* Customer List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredCustomers.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--gray-light)',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center'
            }}
          >
            <Users size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {searchQuery || selectedTier ? 'No customers found' : 'No customers yet'}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.customer_id}
              customer={customer}
              getIconComponent={getIconComponent}
            />
          ))
        )}

        {/* Pagination Controls */}
        <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Showing {Math.min(totalCount, page * CUSTOMERS_PER_PAGE + 1)}-{Math.min((page + 1) * CUSTOMERS_PER_PAGE, totalCount)} of {totalCount}
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
              Page {page + 1} of {Math.ceil(totalCount / CUSTOMERS_PER_PAGE) || 1}
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
      </div>
    </div>
  );
}

// Customer Card Component
function CustomerCard({ customer, getIconComponent }: any) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getCLVCategory = (clv: number) => {
    if (clv >= 5000) return { label: 'High CLV', color: 'var(--success)', bgColor: 'var(--success)20' };
    if (clv >= 1000) return { label: 'Medium CLV', color: '#f59e0b', bgColor: '#fef3c720' };
    return { label: 'Low CLV', color: 'var(--text-secondary)', bgColor: 'var(--gray-light)' };
  };

  const clvCategory = customer.clv ? getCLVCategory(customer.clv) : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--background)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header with tier background */}
      <div
        className="p-4 flex items-center justify-between"
        style={{
          backgroundColor: customer.tier_color ? `${customer.tier_color}20` : 'var(--gray-light)',
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: customer.tier_color || 'var(--primary)',
              color: '#FFFFFF',
            }}
          >
            {customer.tier_icon ? getIconComponent(customer.tier_icon, 24) : <Users size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {customer.customer_name}
            </p>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Phone size={12} />
              <span>{customer.phone}</span>
            </div>
          </div>
        </div>
        {customer.tier_name && (
          <div
            className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
            style={{
              backgroundColor: customer.tier_color || 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: '600',
            }}
          >
            {customer.tier_icon && getIconComponent(customer.tier_icon, 12)}
            <span>{customer.tier_name}</span>
          </div>
        )}
      </div>

      {/* Body with stats */}
      <div className="p-4">
        {/* CLV Badge */}
        {clvCategory && customer.clv > 0 && (
          <div
            className="rounded-lg p-3 mb-3 text-xs flex items-center gap-2"
            style={{
              backgroundColor: clvCategory.bgColor,
              color: clvCategory.color,
            }}
          >
            <Target size={14} />
            <span style={{ fontWeight: '600' }}>
              {clvCategory.label}: {customer.clv.toFixed(0)} br
            </span>
          </div>
        )}

        {/* Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {customer.tags.map((tag: any) => (
              <div
                key={tag.id}
                className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  fontWeight: '500',
                }}
              >
                {tag.icon && getIconComponent(tag.icon, 12)}
                <span>{tag.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Total Spent
            </p>
            <p style={{ fontWeight: '600', color: 'var(--primary)' }}>
              {customer.total_purchases.toFixed(0)} br
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Visits
            </p>
            <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {customer.total_visits}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Last Visit
            </p>
            <p className="text-xs" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {formatDate(customer.last_visit_date)}
            </p>
          </div>
        </div>

        {/* Discount Badge */}
        {customer.discount_percentage && customer.discount_percentage > 0 && (
          <div
            className="rounded-lg p-2 text-xs flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--success)20',
              color: 'var(--success)',
            }}
          >
            <TrendingUp size={14} />
            <span style={{ fontWeight: '600' }}>
              {customer.discount_percentage}% Discount Available
            </span>
          </div>
        )}
      </div>
    </div>
  );
}