import { useState, useEffect, useRef } from 'react';
import { User, UserPlus, Settings, LogOut, X, Eye, EyeOff, Users, Receipt, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import { toast } from 'sonner';
import { useBranch } from '../context/BranchContext';

interface Profile {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface ProfileDropdownProps {
  username: string;
  onLogout: () => void;
  userRole: string;
  onCustomerManagementClick?: () => void;
  onExpensesClick?: () => void;
  onExcelClick?: () => void;
}

export function ProfileDropdown({ username, onLogout, userRole, onCustomerManagementClick, onExpensesClick, onExcelClick }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch current user profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('menal_profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (data) {
        setCurrentProfile(data);
      }
    };
    fetchProfile();
  }, [username]);

  const handleLogoutClick = () => {
    setIsOpen(false);
    onLogout();
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Circular Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full transition-all active:scale-95 flex items-center justify-center shadow-md"
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: 'var(--primary)',
          color: '#FFFFFF',
          border: '2px solid var(--background)',
          boxShadow: isOpen ? '0 0 0 3px rgba(208, 185, 167, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '600' }}>
          {getInitials(username)}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 rounded-xl shadow-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: 'var(--border)',
            width: '220px',
            zIndex: 50,
          }}
        >
          {/* User Info Header */}
          <div
            style={{
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              padding: '16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: '700' }}>
                  {getInitials(username)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px', color: '#FFFFFF' }}>
                  {username}
                </p>
                <p style={{ fontSize: '11px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#FFFFFF' }}>
                  {currentProfile?.role || 'Admin'}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ padding: '8px' }}>
            {/* Only show Customer Management and Create User buttons for admin role */}
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => {
                    if (onCustomerManagementClick) {
                      onCustomerManagementClick();
                    }
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    border: 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '14px' }}>Customer Management</span>
                </button>

                <button
                  onClick={() => {
                    setShowCreateUser(true);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    border: 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '14px' }}>Create User</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                if (onExpensesClick) {
                  onExpensesClick();
                }
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                border: 'none',
                textAlign: 'left',
                fontSize: '14px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Receipt size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px' }}>Expenses</span>
            </button>

            {userRole === 'admin' && (
              <button
                onClick={() => {
                  if (onExcelClick) {
                    onExcelClick();
                  }
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gray-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '14px' }}>Excel Upload</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowEditProfile(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                border: 'none',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Settings size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px' }}>Edit Profile</span>
            </button>

            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--border)',
                margin: '8px 0',
              }}
            />

            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-3 rounded-lg transition-all hover:bg-opacity-80"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--danger)',
                padding: '10px 12px',
                border: 'none',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF2F2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={18} />
              <span style={{ fontSize: '14px' }}>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <CreateUserModal
          onClose={() => setShowCreateUser(false)}
        />
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && currentProfile && (
        <EditProfileModal
          profile={currentProfile}
          onClose={() => setShowEditProfile(false)}
          onUpdate={(updatedProfile) => {
            setCurrentProfile(updatedProfile);
            setShowEditProfile(false);
          }}
        />
      )}
    </div>
  );
}

// Create User Modal Component
interface CreateUserModalProps {
  onClose: () => void;
}

function CreateUserModal({ onClose }: CreateUserModalProps) {
  const { branches, currentBranchId } = useBranch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [selectedBranchId, setSelectedBranchId] = useState(currentBranchId || '');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('menal_profiles')
        .insert({
          username: username.trim(),
          password: password,
          role: role,
          branch_id: selectedBranchId,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Username already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('User created successfully! 🎉');
      onClose();
    } catch (error) {
      console.error('Create user error:', error);
      toast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'var(--background)',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            padding: '20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          <div className="flex items-center gap-2">
            <UserPlus size={24} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF' }}>Create New User</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Username <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-lg border-none outline-none"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Password <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg border-none outline-none"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  paddingRight: '48px',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transition-all"
                style={{
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Confirm Password <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-4 py-3 rounded-lg border-none outline-none"
                style={{
                  backgroundColor: 'var(--gray-light)',
                  color: 'var(--text-primary)',
                  paddingRight: '48px',
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transition-all"
                style={{
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Role <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-none outline-none"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
              }}
              required
            >
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Branch <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBranchId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-none outline-none"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
              }}
              required
            >
              <option value="" disabled>Select a branch</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
                border: 'none',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div >
    </div >
  );
}

// Edit Profile Modal Component
interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onUpdate: (profile: Profile) => void;
}

function EditProfileModal({ profile, onClose, onUpdate }: EditProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    // If changing password, validate
    if (newPassword || confirmNewPassword) {
      if (!currentPassword) {
        toast.error('Please enter your current password');
        return;
      }

      if (newPassword !== confirmNewPassword) {
        toast.error('New passwords do not match');
        return;
      }

      if (newPassword.length < 4) {
        toast.error('Password must be at least 4 characters');
        return;
      }
    }

    setLoading(true);

    try {
      // Verify current password if changing password
      if (newPassword) {
        const { data: verifyData } = await supabase
          .from('menal_profiles')
          .select('password')
          .eq('id', profile.id)
          .single();

        if (verifyData?.password !== currentPassword) {
          toast.error('Current password is incorrect');
          setLoading(false);
          return;
        }
      }

      // Update profile
      const updateData: any = {
        username: username.trim(),
      };

      if (newPassword) {
        updateData.password = newPassword;
      }

      const { data, error } = await supabase
        .from('menal_profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Username already exists');
        } else {
          throw error;
        }
        return;
      }

      // Update local storage if username changed
      if (data.username !== profile.username) {
        const storedUser = localStorage.getItem('menal_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.username = data.username;
          localStorage.setItem('menal_user', JSON.stringify(userData));
        }
      }

      toast.success('Profile updated successfully! 🎉');
      onUpdate(data);
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'var(--background)',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            padding: '20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings size={24} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF' }}>Edit Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label
              className="block text-sm"
              style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
            >
              Username <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 rounded-lg border-none outline-none"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>

          <div
            style={{
              backgroundColor: 'var(--gray-light)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <p
              className="text-xs"
              style={{
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Change Password (Optional)
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label
                className="block text-sm"
                style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 rounded-lg border-none outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    paddingRight: '48px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transition-all"
                  style={{
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                  }}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label
                className="block text-sm"
                style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
              >
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2.5 rounded-lg border-none outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    paddingRight: '48px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transition-all"
                  style={{
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label
                className="block text-sm"
                style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2.5 rounded-lg border-none outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    paddingRight: '48px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transition-all"
                  style={{
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--gray-light)',
                color: 'var(--text-primary)',
                border: 'none',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}