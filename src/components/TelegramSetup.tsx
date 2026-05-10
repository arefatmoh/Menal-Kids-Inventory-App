import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Send, 
  Bot, 
  Users, 
  Settings, 
  Copy, 
  CheckCircle2,
  RefreshCw,
  Bell
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface TelegramConfig {
  id: string;
  bot_token: string;
  bot_username: string | null;
}

interface Subscriber {
  id: string;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  wants_daily: boolean;
  wants_weekly: boolean;
  wants_monthly: boolean;
  created_at: string;
}

export function TelegramSetup({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Config
      const { data: configData, error: configError } = await supabase
        .from('menal_telegram_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (configError) throw configError;
      
      if (configData) {
        setConfig(configData);
        setBotTokenInput(configData.bot_token);
      }

      // Fetch Subscribers
      const { data: subData, error: subError } = await supabase
        .from('menal_telegram_subscribers')
        .select('*')
        .order('created_at', { ascending: false });

      if (subError) {
        // If table doesn't exist yet, it will throw an error, we catch it silently
        if (subError.code === '42P01') {
          console.warn('Subscribers table does not exist yet. Please run the SQL setup script.');
        } else {
          throw subError;
        }
      } else {
        setSubscribers(subData || []);
      }
    } catch (err) {
      console.error('Error fetching Telegram data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!botTokenInput.trim()) {
      toast.error('Bot token is required');
      return;
    }

    setSavingConfig(true);
    try {
      // Validate token structure basic
      if (!botTokenInput.includes(':')) {
        toast.error('Invalid Bot Token format. It should look like 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
        return;
      }

      // We can try to fetch the bot info to get username using standard fetch to Telegram API
      let botUsername = config?.bot_username;
      try {
        const response = await fetch(`https://api.telegram.org/bot${botTokenInput.trim()}/getMe`);
        const data = await response.json();
        if (data.ok && data.result) {
          botUsername = data.result.username;
        } else {
          toast.error('Could not verify token with Telegram. Is it correct?');
          return;
        }
      } catch (e) {
        console.warn('Could not reach Telegram API to verify bot username', e);
      }

      if (config?.id) {
        // Update
        const { error } = await supabase
          .from('menal_telegram_config')
          .update({ bot_token: botTokenInput.trim(), bot_username: botUsername })
          .eq('id', config.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('menal_telegram_config')
          .insert([{ bot_token: botTokenInput.trim(), bot_username: botUsername }]);
        if (error) throw error;
      }

      toast.success('Bot Configuration Saved Successfully!');
      
      // Setup Webhook automatically
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('telegram-bot', {
          body: { action: 'setup_webhook', botToken: botTokenInput.trim() }
        });
        if (edgeError) throw edgeError;
        toast.success('Webhook synced with Supabase Edge Function!');
      } catch (edgeErr) {
        console.error('Webhook setup error (Function might not be deployed yet):', edgeErr);
        toast.info('Settings saved, but could not sync Webhook automatically. Ensure the Edge Function is deployed.');
      }

      fetchData();
    } catch (err: any) {
      console.error('Error saving config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleSubscription = async (subscriberId: string, field: 'wants_daily' | 'wants_weekly' | 'wants_monthly', currentValue: boolean) => {
    try {
      // Optimistic UI update
      setSubscribers(prev => prev.map(s => s.id === subscriberId ? { ...s, [field]: !currentValue } : s));

      const { error } = await supabase
        .from('menal_telegram_subscribers')
        .update({ [field]: !currentValue })
        .eq('id', subscriberId);

      if (error) {
        // Rollback
        setSubscribers(prev => prev.map(s => s.id === subscriberId ? { ...s, [field]: currentValue } : s));
        throw error;
      }
      toast.success('Subscription preferences updated');
    } catch (err) {
      console.error('Error toggling subscription:', err);
      toast.error('Failed to update preferences');
    }
  };

  const handleCopyLink = () => {
    if (!config?.bot_username) return;
    const link = `https://t.me/${config.bot_username}?start=menal`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Invite link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBlastTest = async () => {
    if (!config || subscribers.length === 0) {
      toast.error('Need active configuration and at least one subscriber.');
      return;
    }
    
    setInvoking('blast');
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: { action: 'blast_test' }
      });
      
      if (error) throw error;
      toast.success('Test message sent to all subscribers!');
    } catch (err) {
      console.error('Error blasting test:', err);
      toast.error('Failed to send test message. Check Edge Function logs.');
    } finally {
      setInvoking(null);
    }
  };

  const handlePushNow = async (chatId: string) => {
    setInvoking(`push-${chatId}`);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: { action: 'push_daily_report', target_chat_id: chatId }
      });
      
      if (error) throw error;
      toast.success('Daily report pushed successfully!');
    } catch (err) {
      console.error('Error pushing report:', err);
      toast.error('Failed to push report. Check Edge Function logs.');
    } finally {
      setInvoking(null);
    }
  };

  if (loading) return <LoadingSpinner message="Loading Telegram Settings..." />;

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Send size={24} style={{ color: '#0088cc' }} />
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Telegram Automation</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border shadow-sm p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Bot size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Bot Setup</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder="e.g. 123456789:ABCDEF..."
                  className="w-full px-4 py-2.5 rounded-lg border outline-none"
                  style={{ backgroundColor: 'var(--gray-light)', borderColor: 'var(--border)' }}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                  Get this by creating a new bot with <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: '#0088cc', textDecoration: 'underline' }}>@BotFather</a> on Telegram.
                </p>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  opacity: savingConfig ? 0.7 : 1,
                  border: 'none'
                }}
              >
                {savingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Settings size={18} />}
                Save & Sync Webhook
              </button>
            </div>
          </div>

          {config?.bot_username && (
            <div className="rounded-2xl border shadow-sm p-6" style={{ backgroundColor: '#F0F9FF', borderColor: '#B9E6FE' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#026AA2', marginBottom: '8px' }}>Invite Link</h3>
              <p className="text-sm mb-4" style={{ color: '#026AA2', opacity: 0.8 }}>
                Share this link with your team. They just need to click it and press "Start".
              </p>
              
              <div className="flex items-center gap-2 bg-white rounded-lg p-2 border" style={{ borderColor: '#B9E6FE' }}>
                <input 
                  readOnly 
                  value={`https://t.me/${config.bot_username}?start=menal`}
                  className="flex-1 bg-transparent border-none text-sm outline-none px-2"
                  style={{ color: '#026AA2' }}
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-md transition-all hover:bg-blue-50"
                  style={{ color: '#026AA2' }}
                >
                  {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          )}

          {config && (
            <div className="rounded-2xl border shadow-sm p-6" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Bell size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Testing</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Send a quick test message to all registered subscribers to ensure the bot is working perfectly.
              </p>
              <button
                onClick={handleBlastTest}
                disabled={invoking === 'blast' || subscribers.length === 0}
                className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)',
                  opacity: (invoking === 'blast' || subscribers.length === 0) ? 0.7 : 1
                }}
              >
                {invoking === 'blast' ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                Blast Test Message
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Subscribers */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', minHeight: '400px' }}>
            <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Authorized Audience</h3>
                </div>
                <span className="text-sm px-3 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--gray-light)', color: 'var(--text-secondary)' }}>
                  {subscribers.length} Active
                </span>
              </div>
            </div>

            <div className="p-0">
              {subscribers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                  <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>No subscribers yet</p>
                  <p className="text-sm mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    Once you set up your bot token, share the invite link with your team members to add them here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead style={{ backgroundColor: 'var(--gray-light)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th className="p-4 font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>User</th>
                        <th className="p-4 font-semibold text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Daily (9:30 PM)</th>
                        <th className="p-4 font-semibold text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Weekly (Sun)</th>
                        <th className="p-4 font-semibold text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Monthly (1st)</th>
                        <th className="p-4 font-semibold text-sm text-right" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.map((sub) => (
                        <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--secondary)' }}>
                                {(sub.first_name?.[0] || sub.username?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                  {sub.first_name} {sub.last_name}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {sub.username ? `@${sub.username}` : sub.chat_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <Toggle 
                              checked={sub.wants_daily} 
                              onChange={() => toggleSubscription(sub.id, 'wants_daily', sub.wants_daily)} 
                            />
                          </td>
                          <td className="p-4 text-center">
                            <Toggle 
                              checked={sub.wants_weekly} 
                              onChange={() => toggleSubscription(sub.id, 'wants_weekly', sub.wants_weekly)} 
                            />
                          </td>
                          <td className="p-4 text-center">
                            <Toggle 
                              checked={sub.wants_monthly} 
                              onChange={() => toggleSubscription(sub.id, 'wants_monthly', sub.wants_monthly)} 
                            />
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handlePushNow(sub.chat_id)}
                              disabled={invoking === `push-${sub.chat_id}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{ 
                                backgroundColor: 'var(--primary)', 
                                color: '#FFF',
                                opacity: invoking === `push-${sub.chat_id}` ? 0.7 : 1
                              }}
                            >
                              {invoking === `push-${sub.chat_id}` ? 'Sending...' : 'Push Now'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple Toggle Component
function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
      style={{ backgroundColor: checked ? 'var(--success)' : 'var(--border)' }}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
