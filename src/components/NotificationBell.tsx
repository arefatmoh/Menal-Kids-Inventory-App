import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, RotateCcw, Clock, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { useBranch } from '../context/BranchContext';
import { toast } from 'sonner';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// Fire a native notification on mobile, or browser notification on web
const fireDeviceNotification = async (title: string, body: string) => {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            smallIcon: 'ic_stat_icon_config_sample',
            largeIcon: 'ic_launcher',
            sound: 'default',
          }]
        });
      }
    } else if ('Notification' in window) {
      // Request permission if not yet decided
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    }
  } catch (e) {
    console.log('Notification error (non-critical):', e);
  }
};

interface ReturnRequest {
  id: string;
  branch_id: string;
  sale_id: string;
  sale_item_id: string | null;
  return_quantity: number;
  deduction_amount: number;
  product_name: string | null;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  metadata: any;
  created_at: string;
}

interface NotificationBellProps {
  username: string;
  userRole?: string;
}

export function NotificationBell({ username, userRole = 'admin' }: NotificationBellProps) {
  const { currentBranchId } = useBranch();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [activityNotifs, setActivityNotifs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  // Fetch requests based on role
  const fetchRequests = async () => {
    if (!currentBranchId) return;
    let query = supabase
      .from('menal_return_requests')
      .select('*')
      .eq('branch_id', currentBranchId)
      .order('created_at', { ascending: false });

    if (isAdmin) {
      // Admin sees all pending requests
      query = query.eq('status', 'pending');
    } else {
      // Staff sees their own requests (all statuses, recent ones)
      query = query.eq('requested_by', username).limit(20);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRequests(data);
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    if (!currentBranchId) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Admin sees sales, staff sees product/stock changes
    const types = isAdmin ? ['sale'] : ['product_created', 'stock_adjustment'];
    const { data, error } = await supabase
      .from('menal_activity_log')
      .select('*')
      .eq('branch_id', currentBranchId)
      .in('type', types)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setActivityNotifs(data.map(d => ({
        id: d.id,
        type: d.type,
        details: d.details,
        metadata: d.metadata,
        created_at: d.created_at,
      })));
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchRecentActivity();
  }, [currentBranchId]);

  // Realtime subscription
  useEffect(() => {
    if (!currentBranchId) return;

    const channel = supabase
      .channel('return-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menal_return_requests',
          filter: `branch_id=eq.${currentBranchId}`
        },
        (payload) => {
          const settings = (() => {
            try { return JSON.parse(localStorage.getItem('menal_notification_settings') || '{}'); } catch(e) { return {}; }
          })();
          const approvalsEnabled = settings.approvals !== false;

          if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
            if (isAdmin) {
              setRequests(prev => [payload.new as ReturnRequest, ...prev]);
              if (approvalsEnabled) {
                fireDeviceNotification(
                  'Return Request',
                  `${payload.new.requested_by} wants to return ${payload.new.return_quantity}x ${payload.new.product_name || 'items'}`
                );
              }
              toast.info(`New return request from ${payload.new.requested_by}`);
            } else if (payload.new.requested_by === username) {
              // Staff sees their own new request
              setRequests(prev => [payload.new as ReturnRequest, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (isAdmin) {
              // Admin: remove from list if no longer pending
              if (payload.new.status !== 'pending') {
                setRequests(prev => prev.filter(r => r.id !== payload.new.id));
              }
            } else if (payload.new.requested_by === username) {
              // Staff: update the status in their list in real-time
              setRequests(prev => prev.map(r =>
                r.id === payload.new.id ? { ...r, ...payload.new as ReturnRequest } : r
              ));
              if (approvalsEnabled) {
                if (payload.new.status === 'approved') {
                  fireDeviceNotification('Return Approved ✅', `Your return of ${payload.new.return_quantity}x ${payload.new.product_name || 'items'} was approved`);
                  toast.success(`Your return request was approved!`);
                } else if (payload.new.status === 'rejected') {
                  fireDeviceNotification('Return Rejected ❌', `Your return of ${payload.new.return_quantity}x ${payload.new.product_name || 'items'} was rejected`);
                  toast.error(`Your return request was rejected`);
                }
              }
            }
          }
        }
      )
      .subscribe();

    // Request browser notification permission on web immediately
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        console.log('Browser notification permission:', p);
      });
    }
    // Request Capacitor permissions on native
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions().then(p => {
        console.log('Native notification permission:', p.display);
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBranchId]);

  // Activity log subscription (admin: sales, staff: product/stock)
  useEffect(() => {
    if (!currentBranchId) return;

    const relevantTypes = isAdmin ? ['sale'] : ['product_created', 'stock_adjustment'];

    const activityChannel = supabase
      .channel('activity-log-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menal_activity_log',
          filter: `branch_id=eq.${currentBranchId}`
        },
        (payload) => {
          const settings = (() => {
            try { return JSON.parse(localStorage.getItem('menal_notification_settings') || '{}'); } catch(e) { return {}; }
          })();
          const salesEnabled = settings.sales !== false;
          const updatesEnabled = settings.updates !== false;

          const entry = payload.new;
          const type = entry.type;
          if (!relevantTypes.includes(type)) return;

          const notif = {
            id: entry.id,
            type,
            details: entry.details,
            metadata: entry.metadata,
            created_at: entry.created_at,
          };
          setActivityNotifs(prev => [notif, ...prev].slice(0, 30));

          if (isAdmin && type === 'sale') {
            const total = entry.metadata?.finalTotal || entry.metadata?.total || entry.metadata?.final_total || 0;
            const by = entry.metadata?.cashier || entry.metadata?.username || 'Staff';
            const items = entry.metadata?.items || [];
            const productNames = items.slice(0, 2).map((item: any) => item.productName || item.product_name).join(', ');
            const suffix = items.length > 2 ? '...' : '';
            const title = items.length > 0 ? `${productNames}${suffix}` : 'Items';
            
            toast(`💰 Sale: ${Math.round(total)} br (${title}) by ${by}`, { duration: 4000 });
            if (salesEnabled) {
              fireDeviceNotification(`New Sale: ${Math.round(total)} br 💰`, `${title} sold by ${by}`);
            }
          } else if (!isAdmin) {
            // Staff: product/stock — toast + system notification
            if (type === 'product_created') {
              const name = entry.metadata?.name || 'New product';
              toast.info(`New product added: ${name}`);
              if (updatesEnabled) fireDeviceNotification('New Product Added 📦', name);
            } else if (type === 'stock_adjustment') {
              const name = entry.metadata?.product_name || 'Product';
              const amount = entry.metadata?.amount || entry.metadata?.adjustment || 0;
              const direction = amount > 0 ? 'added' : 'removed';
              toast.info(`Stock updated: ${name} (${amount > 0 ? '+' : ''}${amount})`);
              if (updatesEnabled) fireDeviceNotification('Stock Updated 📈', `${name}: ${Math.abs(amount)} units ${direction}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
    };
  }, [currentBranchId, isAdmin]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApprove = async (req: ReturnRequest) => {
    setProcessing(req.id);
    try {
      const { error } = await supabase.rpc('menal_approve_return_request', {
        p_request_id: req.id,
        p_reviewer: username
      });
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== req.id));
      toast.success(`Approved return of ${req.return_quantity}x ${req.product_name || 'items'}`);
    } catch (err: any) {
      console.error('Approve error:', err);
      toast.error(err.message || 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (req: ReturnRequest) => {
    setProcessing(req.id);
    try {
      const { error } = await supabase.rpc('menal_reject_return_request', {
        p_request_id: req.id,
        p_reviewer: username
      });
      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== req.id));
      toast.success('Return request rejected');
    } catch (err: any) {
      console.error('Reject error:', err);
      toast.error(err.message || 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const pendingCount = isAdmin
    ? requests.length
    : requests.filter(r => r.status === 'pending').length;

  const totalBadge = isAdmin ? pendingCount : pendingCount + activityNotifs.length;

  const handleDismiss = (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleDismissActivity = (id: string) => {
    setActivityNotifs(prev => prev.filter(n => n.id !== id));
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#FEF9C3', color: '#854d0e', label: '⏳ Pending' };
      case 'approved': return { bg: '#DCFCE7', color: '#166534', label: '✅ Approved' };
      case 'rejected': return { bg: '#FEE2E2', color: '#991B1B', label: '❌ Rejected' };
      default: return { bg: 'var(--gray-light)', color: 'var(--text-secondary)', label: status };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full transition-all active:scale-95"
        style={{
          color: 'var(--text-primary)',
          backgroundColor: isOpen ? 'var(--gray-light)' : 'transparent',
        }}
      >
        <Bell size={22} strokeWidth={2} />
        {totalBadge > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full text-white font-bold"
            style={{
              top: '2px',
              right: '2px',
              minWidth: '18px',
              height: '18px',
              fontSize: '10px',
              backgroundColor: 'var(--danger)',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 rounded-xl shadow-2xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            width: '340px',
            maxHeight: '420px',
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b" style={{ padding: '14px 16px', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {isAdmin ? 'Return Approvals' : 'My Return Requests'}
            </h3>
            {pendingCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--danger)', color: '#fff' }}>
                {pendingCount} pending
              </span>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
            {requests.length > 0 && (
              requests.map(req => {
                const statusInfo = getStatusStyle(req.status);
                return (
                  <div
                    key={req.id}
                    className="border-b"
                    style={{ padding: '14px 16px', borderColor: 'var(--border)' }}
                  >
                    {/* Request Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                        <RotateCcw size={16} style={{ color: 'var(--danger)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {req.sale_item_id ? (
                            <>{req.return_quantity}x {req.product_name || 'Item'}</>
                          ) : (
                            <>Return All Items</>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {isAdmin ? (
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              by <strong>{req.requested_by}</strong>
                            </span>
                          ) : (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                            >
                              {statusInfo.label}
                            </span>
                          )}
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Clock size={10} /> {formatTime(req.created_at)}
                          </span>
                        </div>
                        <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--danger)' }}>
                          -{Math.round(req.deduction_amount)} br
                        </p>
                      </div>
                    </div>

                    {/* Admin: Action Buttons */}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(req)}
                          disabled={processing === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-primary)', opacity: processing === req.id ? 0.5 : 1 }}
                        >
                          <X size={14} />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={processing === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-all"
                          style={{ backgroundColor: 'var(--success)', opacity: processing === req.id ? 0.5 : 1 }}
                        >
                          <Check size={14} />
                          Approve
                        </button>
                      </div>
                    )}

                    {/* Staff: Dismiss processed requests */}
                    {!isAdmin && req.status !== 'pending' && (
                      <button
                        onClick={() => handleDismiss(req.id)}
                        className="w-full py-1.5 rounded-lg text-xs transition-all"
                        style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)' }}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* Activity Notifications (Admin: Sales, Staff: Updates) */}
            {activityNotifs.length > 0 && (
              <>
                <div className="border-b" style={{ padding: '10px 16px', borderColor: 'var(--border)', backgroundColor: 'var(--gray-light)' }}>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                    {isAdmin ? 'Recent Sales' : 'Recent Updates'}
                  </p>
                </div>
                {activityNotifs.map(notif => (
                  <div
                    key={notif.id}
                    className="border-b"
                    style={{ padding: '12px 16px', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg flex-shrink-0" style={{
                        backgroundColor: notif.type === 'sale' ? '#F3E8FF'
                          : notif.type === 'product_created' ? '#EFF6FF' : '#F0FDF4'
                      }}>
                        {notif.type === 'sale' ? (
                          <ShoppingCart size={16} style={{ color: '#9333EA' }} />
                        ) : notif.type === 'product_created' ? (
                          <Package size={16} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {notif.type === 'sale'
                            ? (() => {
                                const total = notif.metadata?.finalTotal || notif.metadata?.total || notif.metadata?.final_total || 0;
                                const items = notif.metadata?.items || [];
                                const productNames = items.slice(0, 2).map((item: any) => item.productName || item.product_name).join(', ');
                                const suffix = items.length > 2 ? '...' : '';
                                const title = items.length > 0 ? ` (${productNames}${suffix})` : '';
                                return `Sale: ${Math.round(total)} br${title}`;
                              })()
                            : notif.type === 'product_created'
                              ? (notif.metadata?.name || 'New Product')
                              : (notif.metadata?.product_name || 'Stock Updated')}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {notif.type === 'sale'
                            ? `by ${notif.metadata?.cashier || notif.metadata?.username || 'Staff'}`
                            : notif.details}
                        </p>
                        <span className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--text-secondary)' }}>
                          <Clock size={10} /> {formatTime(notif.created_at)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDismissActivity(notif.id)}
                        className="p-1 rounded flex-shrink-0"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Empty state */}
            {requests.length === 0 && activityNotifs.length === 0 && (
              <div className="text-center" style={{ padding: '32px 16px' }}>
                <Check size={32} className="mx-auto mb-2" style={{ color: 'var(--success)', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
