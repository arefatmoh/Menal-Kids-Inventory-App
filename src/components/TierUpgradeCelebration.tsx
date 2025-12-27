import { X, Crown, Award, Medal, Gem, Sparkles, TrendingUp } from 'lucide-react';

interface TierUpgradeCelebrationProps {
  customerName: string;
  oldTierName: string;
  newTierName: string;
  newTierColor: string;
  newTierIcon: string;
  discountPercentage: number;
  onClose: () => void;
}

export function TierUpgradeCelebration({
  customerName,
  oldTierName,
  newTierName,
  newTierColor,
  newTierIcon,
  discountPercentage,
  onClose,
}: TierUpgradeCelebrationProps) {
  const getTierIcon = (iconName: string) => {
    const icons: any = {
      crown: Crown,
      award: Award,
      medal: Medal,
      gem: Gem,
    };
    return icons[iconName] || Medal;
  };

  const Icon = getTierIcon(newTierIcon);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-3xl p-8 relative overflow-hidden"
        style={{ backgroundColor: 'var(--background)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Background */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${newTierColor}, transparent)`,
          }}
        />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full transition-all active:scale-95"
          style={{ backgroundColor: 'var(--gray-light)' }}
        >
          <X size={20} style={{ color: 'var(--text-secondary)' }} />
        </button>

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Sparkles Animation */}
          <div className="mb-4">
            <Sparkles 
              size={32} 
              style={{ color: newTierColor, margin: '0 auto' }}
              className="animate-pulse"
            />
          </div>

          {/* Title */}
          <h2 className="mb-2" style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
            🎉 Tier Upgrade!
          </h2>

          {/* Customer Name */}
          <p className="text-xl mb-4" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {customerName}
          </p>

          {/* Tier Icons and Arrow */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Old Tier */}
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-2 opacity-50"
                style={{ backgroundColor: 'var(--gray-light)' }}
              >
                <TrendingUp size={28} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {oldTierName}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center">
              <TrendingUp size={24} style={{ color: newTierColor }} />
            </div>

            {/* New Tier */}
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-2 animate-bounce"
                style={{ 
                  backgroundColor: newTierColor + '20',
                  border: `3px solid ${newTierColor}`,
                }}
              >
                <Icon size={28} style={{ color: newTierColor }} />
              </div>
              <p 
                className="text-xs" 
                style={{ color: newTierColor, fontWeight: '700' }}
              >
                {newTierName}
              </p>
            </div>
          </div>

          {/* Upgrade Message */}
          <div 
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: newTierColor + '10' }}
          >
            <p className="text-sm mb-2" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              New Benefits Unlocked
            </p>
            {discountPercentage > 0 && (
              <div className="flex items-center justify-center gap-2">
                <div 
                  className="px-3 py-1 rounded-full text-sm"
                  style={{ 
                    backgroundColor: newTierColor,
                    color: 'white',
                    fontWeight: '700',
                  }}
                >
                  {discountPercentage}% Discount
                </div>
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              on all future purchases
            </p>
          </div>

          {/* Celebration Message */}
          <div 
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: 'var(--gray-light)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              🎊 Congratulations! Your loyalty has earned you <span style={{ fontWeight: '700', color: newTierColor }}>{newTierName}</span> status. 
              Thank you for being a valued customer!
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full rounded-xl py-4 transition-all active:scale-95"
            style={{ 
              backgroundColor: newTierColor,
              color: 'white',
            }}
          >
            <span style={{ fontWeight: '700' }}>Celebrate! 🎉</span>
          </button>

          {/* Staff Note */}
          <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
            💡 Staff: Congratulate {customerName.split(' ')[0]} on their upgrade!
          </p>
        </div>

        {/* Decorative Elements */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          .animate-bounce {
            animation: float 2s ease-in-out infinite;
          }
          
          .animate-pulse {
            animation: pulse 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  );
}
