import { useState, useEffect } from 'react';
import {
  Users,
  Crown,
  Tag,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Award,
  Medal,
  Gem,
  Star
} from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';

interface CustomerSegmentationProps {
  onBack: () => void;
}

export function CustomerSegmentation({ onBack }: CustomerSegmentationProps) {
  const [activeTab, setActiveTab] = useState<'tiers' | 'tags'>('tiers');
  const [tiers, setTiers] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Fetch tiers
    const { data: tiersData } = await supabase
      .from('menal_customer_tiers')
      .select('*')
      .order('display_order');

    // Fetch tags
    const { data: tagsData } = await supabase
      .from('menal_customer_tags')
      .select('*')
      .order('name');

    setTiers(tiersData || []);
    setTags(tagsData || []);
    setLoading(false);
  };

  const handleSaveTier = async (formData: any) => {
    try {
      if (editingItem?.id) {
        // Update existing
        await supabase
          .from('menal_customer_tiers')
          .update(formData)
          .eq('id', editingItem.id);
        toast.success('Tier updated');
      } else {
        // Create new
        await supabase
          .from('menal_customer_tiers')
          .insert(formData);
        toast.success('Tier created');
      }
      setShowModal(false);
      setEditingItem(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveTag = async (formData: any) => {
    try {
      if (editingItem?.id) {
        // Update existing
        await supabase
          .from('menal_customer_tags')
          .update(formData)
          .eq('id', editingItem.id);
        toast.success('Tag updated');
      } else {
        // Create new
        await supabase
          .from('menal_customer_tags')
          .insert(formData);
        toast.success('Tag created');
      }
      setShowModal(false);
      setEditingItem(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Delete this tier?')) return;

    await supabase
      .from('menal_customer_tiers')
      .delete()
      .eq('id', id);

    toast.success('Tier deleted');
    loadData();
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;

    await supabase
      .from('menal_customer_tags')
      .delete()
      .eq('id', id);

    toast.success('Tag deleted');
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="inline-block rounded-full animate-spin"
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--gray-light)',
              borderTop: '3px solid var(--primary)'
            }}
          />
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px', padding: '0 16px 80px 16px' }}>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          className="rounded-full transition-all active:scale-95"
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--gray-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '4px' }}>
            Customer Management
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Manage tiers and tags
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px' }}>
        <div className="rounded-xl" style={{ backgroundColor: 'var(--gray-light)', padding: '20px' }}>
          <Crown size={24} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
          <p style={{ fontSize: '28px', fontWeight: '600', marginBottom: '4px' }}>{tiers.length}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tiers</p>
        </div>
        <div className="rounded-xl" style={{ backgroundColor: 'var(--gray-light)', padding: '20px' }}>
          <Tag size={24} style={{ color: 'var(--secondary)', marginBottom: '12px' }} />
          <p style={{ fontSize: '28px', fontWeight: '600', marginBottom: '4px' }}>{tags.length}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tags</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ backgroundColor: 'var(--gray-light)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('tiers')}
          className="flex-1 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: activeTab === 'tiers' ? 'var(--background)' : 'transparent',
            color: activeTab === 'tiers' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tiers' ? 600 : 400,
          }}
        >
          Tiers
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className="flex-1 py-2 rounded-lg transition-all"
          style={{
            backgroundColor: activeTab === 'tags' ? 'var(--background)' : 'transparent',
            color: activeTab === 'tags' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tags' ? 600 : 400,
          }}
        >
          Tags
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tiers' && (
        <div>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            className="w-full mb-4 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF' }}
          >
            <Plus size={20} />
            <span>Add Tier</span>
          </button>

          {tiers.length === 0 ? (
            <div className="text-center py-12">
              <Crown size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No tiers yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--background)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                >
                  {/* Header with tier color background */}
                  <div
                    className="p-4 flex items-center justify-between"
                    style={{ backgroundColor: tier.color || 'var(--primary)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center">
                        {getIcon(tier.icon, 24, '#FFFFFF')}
                      </div>
                      <div>
                        <p style={{ fontWeight: '600', color: '#FFFFFF', fontSize: '16px' }}>
                          {tier.name}
                        </p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {tier.discount_percentage}% discount
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(tier);
                          setShowModal(true);
                        }}
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTier(tier.id)}
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Body with stats */}
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-2xs mb-1" style={{ color: 'var(--text-secondary)' }}>Min Purchase</p>
                        <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tier.min_purchases} br</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Min Visits</p>
                        <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tier.min_visits}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Order</p>
                        <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{tier.display_order}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tags' && (
        <div>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            className="w-full mb-4 py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF' }}
          >
            <Plus size={20} />
            <span>Add Tag</span>
          </button>

          {tags.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No tags yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: 'var(--gray-light)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-full"
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: tag.color + '20',
                        }}
                      />
                      <div>
                        <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {tag.name}
                        </p>
                        {tag.description && (
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {tag.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(tag);
                          setShowModal(true);
                        }}
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--primary)' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-2 rounded-lg transition-all active:scale-95"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        activeTab === 'tiers' ? (
          <TierModal
            tier={editingItem}
            onClose={() => {
              setShowModal(false);
              setEditingItem(null);
            }}
            onSave={handleSaveTier}
          />
        ) : (
          <TagModal
            tag={editingItem}
            onClose={() => {
              setShowModal(false);
              setEditingItem(null);
            }}
            onSave={handleSaveTag}
          />
        )
      )}
    </div>
  );
}

// Tier Modal
function TierModal({ tier, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: tier?.name || '',
    icon: tier?.icon || 'crown',
    color: tier?.color || '#714329',
    min_purchases: tier?.min_purchases || 0,
    min_visits: tier?.min_visits || 0,
    discount_percentage: tier?.discount_percentage || 0,
    display_order: tier?.display_order || 0,
    is_active: tier?.is_active ?? true,
  });

  const colors = [
    { name: 'Bronze', value: '#CD7F32' },
    { name: 'Chocolate', value: '#714329' },
    { name: 'Gold', value: '#D4AF37' },
    { name: 'Silver', value: '#C0C0C0' },
    { name: 'Rose Gold', value: '#B76E79' },
    { name: 'Emerald', value: '#50C878' },
    { name: 'Sapphire', value: '#0F52BA' },
    { name: 'Ruby', value: '#E0115F' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full"
        style={{
          backgroundColor: 'var(--background)',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between"
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            padding: '20px 24px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          <div className="flex items-center gap-2">
            <Crown size={24} style={{ color: '#FFFFFF' }} />
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '600' }}>
              {tier ? 'Edit Tier' : 'New Tier'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-all active:scale-95"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#FFFFFF' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Gold"
              className="w-full px-4 py-3 rounded-lg"
              style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Icon
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-3 rounded-lg"
              style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
            >
              <option value="crown">👑 Crown</option>
              <option value="award">🏆 Award</option>
              <option value="medal">🏅 Medal</option>
              <option value="gem">💎 Gem</option>
              <option value="star">⭐ Star</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Color
            </label>
            <div className="grid grid-cols-4 gap-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all active:scale-95"
                  style={{
                    backgroundColor: formData.color === color.value ? color.value + '20' : 'var(--gray-light)',
                    border: formData.color === color.value ? `2px solid ${color.value}` : '2px solid transparent',
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: color.value,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                Min Purchase (br)
              </label>
              <input
                type="number"
                value={formData.min_purchases}
                onChange={(e) => setFormData({ ...formData, min_purchases: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg"
                style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                Min Visits
              </label>
              <input
                type="number"
                value={formData.min_visits}
                onChange={(e) => setFormData({ ...formData, min_visits: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg"
                style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                Discount (%)
              </label>
              <input
                type="number"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg"
                style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg"
                style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded"
              style={{ accentColor: 'var(--primary)' }}
            />
            <label htmlFor="is_active" className="text-sm" style={{ fontWeight: '500' }}>Active</label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{ backgroundColor: 'var(--gray-light)', fontWeight: '600' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: '600' }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Tag Modal
function TagModal({ tag, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: tag?.name || '',
    color: tag?.color || '#714329',
    icon: tag?.icon || 'star',
    description: tag?.description || '',
    is_active: tag?.is_active ?? true,
  });

  const colors = [
    { name: 'Chocolate', value: '#714329' },
    { name: 'Gold', value: '#D4AF37' },
    { name: 'Rose', value: '#E8A5A5' },
    { name: 'Emerald', value: '#50C878' },
    { name: 'Lavender', value: '#9B7EBD' },
    { name: 'Coral', value: '#FF6B6B' },
    { name: 'Sky Blue', value: '#87CEEB' },
    { name: 'Peach', value: '#FFB347' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full"
        style={{
          backgroundColor: 'var(--background)',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between"
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            padding: '20px 24px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          <div className="flex items-center gap-2">
            <Tag size={24} style={{ color: '#FFFFFF' }} />
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '600' }}>
              {tag ? 'Edit Tag' : 'New Tag'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-all active:scale-95"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#FFFFFF' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., VIP"
              className="w-full px-4 py-3 rounded-lg"
              style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Icon
            </label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-3 rounded-lg"
              style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
            >
              <option value="star">⭐ Star</option>
              <option value="repeat">🔄 Repeat</option>
              <option value="sparkles">✨ Sparkles</option>
              <option value="alert-circle">⚠️ Alert</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Color
            </label>
            <div className="grid grid-cols-4 gap-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all active:scale-95"
                  style={{
                    backgroundColor: formData.color === color.value ? color.value + '20' : 'var(--gray-light)',
                    border: formData.color === color.value ? `2px solid ${color.value}` : '2px solid transparent',
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: color.value,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {color.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
              className="w-full px-4 py-3 rounded-lg resize-none"
              style={{ backgroundColor: 'var(--gray-light)', border: 'none', outline: 'none' }}
            />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <input
              type="checkbox"
              id="tag_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded"
              style={{ accentColor: 'var(--primary)' }}
            />
            <label htmlFor="tag_is_active" className="text-sm" style={{ fontWeight: '500' }}>Active</label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{ backgroundColor: 'var(--gray-light)', fontWeight: '600' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: '600' }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper function to get icon based on name
function getIcon(iconName: string, size: number, color: string) {
  switch (iconName) {
    case 'crown':
      return <Crown size={size} style={{ color: color }} />;
    case 'award':
      return <Award size={size} style={{ color: color }} />;
    case 'medal':
      return <Medal size={size} style={{ color: color }} />;
    case 'gem':
      return <Gem size={size} style={{ color: color }} />;
    case 'star':
      return <Star size={size} style={{ color: color }} />;
    default:
      return <Crown size={size} style={{ color: color }} />;
  }
}