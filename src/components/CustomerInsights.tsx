import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Crown,
  Tag,
  AlertCircle,
  DollarSign,
  Award,
  Medal,
  Gem,
  Star,
  Sparkles,
  Repeat,
  ArrowRight,
  Target
} from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { LoadingSpinner } from './LoadingSpinner';

interface TierDistribution {
  tier_name: string;
  customer_count: number;
  total_revenue: number;
  tier_color: string;
  tier_icon: string;
}

interface TagPerformance {
  tag_name: string;
  customer_count: number;
  total_revenue: number;
  tag_color: string;
}

interface AtRiskCustomer {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  last_visit_date: string | null;
  days_since_last_visit: number;
  total_purchases: number;
  risk_level: 'high' | 'medium' | 'low';
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  total_purchases: number;
  clv: number;
  tier_name: string | null;
  tier_color: string | null;
}

interface CustomerInsightsProps {
  dateRange?: 'today' | 'week' | 'month' | 'year';
}

export function CustomerInsights({ dateRange = 'month' }: CustomerInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([]);
  const [tagPerformance, setTagPerformance] = useState<TagPerformance[]>([]);
  const [atRiskCustomers, setAtRiskCustomers] = useState<AtRiskCustomer[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newCustomersThisMonth: 0,
    tierUpgradesThisMonth: 0,
    averageClv: 0,
  });

  useEffect(() => {
    fetchInsights();
  }, [dateRange]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      // Fetch tier distribution
      const { data: tierData } = await supabase
        .from('menal_customers_with_segments')
        .select('tier_name, tier_color, tier_icon, total_purchases');

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

      // Fetch tag performance
      const { data: tagsData } = await supabase
        .from('menal_customer_tags')
        .select(`
          id,
          name,
          color,
          menal_customer_segments!inner(customer_id, menal_customers!inner(total_purchases))
        `)
        .eq('is_active', true);

      if (tagsData) {
        const tagGroups = tagsData.map((tag: any) => ({
          tag_name: tag.name,
          customer_count: tag.menal_customer_segments?.length || 0,
          total_revenue: tag.menal_customer_segments?.reduce((sum: number, seg: any) =>
            sum + (seg.menal_customers?.total_purchases || 0), 0) || 0,
          tag_color: tag.color,
        }));
        setTagPerformance(tagGroups);
      }

      // Fetch at-risk customers
      const { data: atRiskData } = await supabase
        .rpc('menal_get_at_risk_customers', { days_threshold: 60 });

      if (atRiskData) {
        setAtRiskCustomers(atRiskData.slice(0, 5)); // Top 5 at-risk
      }

      // Fetch top customers by CLV
      const { data: customersData } = await supabase
        .from('menal_customers')
        .select(`
          id,
          name,
          phone,
          total_purchases,
          menal_customer_segments(tier_id, menal_customer_tiers(name, color))
        `)
        .order('total_purchases', { ascending: false })
        .limit(5);

      if (customersData) {
        const topWithClv = await Promise.all(
          customersData.map(async (customer: any) => {
            const { data: clvData } = await supabase
              .rpc('menal_calculate_customer_clv', { customer_uuid: customer.id });

            return {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              total_purchases: customer.total_purchases || 0,
              clv: clvData || 0,
              tier_name: customer.menal_customer_segments?.[0]?.menal_customer_tiers?.name || null,
              tier_color: customer.menal_customer_segments?.[0]?.menal_customer_tiers?.color || null,
            };
          })
        );
        setTopCustomers(topWithClv);
      }

      // Calculate stats
      const { count: totalCount } = await supabase
        .from('menal_customers')
        .select('*', { count: 'exact', head: true });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: newCount } = await supabase
        .from('menal_customers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: upgradeCount } = await supabase
        .from('menal_customer_tier_history')
        .select('*', { count: 'exact', head: true })
        .gte('changed_at', thirtyDaysAgo.toISOString());

      // Calculate average CLV
      let avgClv = 0;
      if (customersData && customersData.length > 0) {
        const clvSum = topCustomers.reduce((sum, c) => sum + c.clv, 0);
        avgClv = clvSum / topCustomers.length;
      }

      setStats({
        totalCustomers: totalCount || 0,
        newCustomersThisMonth: newCount || 0,
        tierUpgradesThisMonth: upgradeCount || 0,
        averageClv: avgClv,
      });

    } catch (error) {
      console.error('Error fetching customer insights:', error);
      toast.error('Failed to load customer insights');
    } finally {
      setLoading(false);
    }
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

  const getTagIcon = (tagName: string) => {
    const lowerName = tagName.toLowerCase();
    if (lowerName.includes('vip')) return Star;
    if (lowerName.includes('regular')) return Repeat;
    if (lowerName.includes('new')) return Sparkles;
    if (lowerName.includes('risk')) return AlertCircle;
    return Tag;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Total Customers
            </span>
          </div>
          <p className="text-2xl" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {stats.totalCustomers}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
            +{stats.newCustomersThisMonth} this month
          </p>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} style={{ color: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Tier Upgrades
            </span>
          </div>
          <p className="text-2xl" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {stats.tierUpgradesThisMonth}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Last 30 days
          </p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: 'var(--gray-light)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              Tier Distribution
            </h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {tierDistribution.length} tiers
          </span>
        </div>

        <div className="space-y-3">
          {tierDistribution.map((tier) => {
            const Icon = getTierIcon(tier.tier_icon);
            const percentage = stats.totalCustomers > 0
              ? ((tier.customer_count / stats.totalCustomers) * 100).toFixed(0)
              : 0;

            return (
              <div key={tier.tier_name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon size={16} style={{ color: tier.tier_color }} />
                    <span className="text-sm" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {tier.tier_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tier.customer_count} customers
                    </span>
                    <span className="text-sm" style={{ fontWeight: '600', color: tier.tier_color }}>
                      {percentage}%
                    </span>
                  </div>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--background)' }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: tier.tier_color,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Total Revenue
                  </span>
                  <span className="text-xs" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {tier.total_revenue.toLocaleString()} br
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tag Performance */}
      {tagPerformance.length > 0 && (
        <div
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                Tag Performance
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {tagPerformance.map((tag) => {
              const Icon = getTagIcon(tag.tag_name);

              return (
                <div
                  key={tag.tag_name}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--background)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full p-2"
                      style={{ backgroundColor: tag.tag_color + '20' }}
                    >
                      <Icon size={16} style={{ color: tag.tag_color }} />
                    </div>
                    <div>
                      <p className="text-sm" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {tag.tag_name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {tag.customer_count} customers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {tag.total_revenue.toLocaleString()} br
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      revenue
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Customers by CLV */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ backgroundColor: 'var(--gray-light)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              Top Customers (CLV)
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {topCustomers.map((customer, index) => (
            <div
              key={customer.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: customer.tier_color || 'var(--primary)',
                    color: 'white'
                  }}
                >
                  <span style={{ fontWeight: '700', fontSize: '0.75rem' }}>
                    {index + 1}
                  </span>
                </div>
                <div>
                  <p className="text-sm" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {customer.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {customer.tier_name || 'No Tier'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm" style={{ fontWeight: '700', color: 'var(--success)' }}>
                  {customer.clv.toLocaleString()} br
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  CLV
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* At-Risk Customers */}
      {atRiskCustomers.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} style={{ color: 'var(--error)' }} />
              <h3 style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                At-Risk Customers
              </h3>
            </div>
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--error)',
                color: 'white'
              }}
            >
              {atRiskCustomers.length}
            </span>
          </div>

          <div className="space-y-2">
            {atRiskCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--background)' }}
              >
                <div>
                  <p className="text-sm" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                    {customer.customer_name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {Math.round(customer.days_since_last_visit)} days since last visit
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: customer.risk_level === 'high'
                        ? 'var(--error)'
                        : customer.risk_level === 'medium'
                          ? '#f59e0b'
                          : 'var(--gray)',
                      color: 'white',
                      fontWeight: '600',
                    }}
                  >
                    {customer.risk_level}
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-4 p-3 rounded-lg flex items-start gap-2"
            style={{ backgroundColor: 'var(--background)' }}
          >
            <AlertCircle size={16} style={{ color: 'var(--primary)', marginTop: '2px' }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              These customers haven't made a purchase in 60+ days. Consider reaching out with a personalized offer or promotion.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tierDistribution.length === 0 && tagPerformance.length === 0 && atRiskCustomers.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <Users size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto' }} />
          <p className="mt-4" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
            No Customer Data Yet
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            Start making sales to see customer insights and analytics here.
          </p>
        </div>
      )}
    </div>
  );
}