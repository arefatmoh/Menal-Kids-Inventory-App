import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Award, TrendingUp, Package, ShoppingBag, Heart, Star, Check, X } from 'lucide-react';

interface LaunchCelebrationProps {
  onClose: () => void;
}

export function LaunchCelebration({ onClose }: LaunchCelebrationProps) {
  const [step, setStep] = useState(0);
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // Generate confetti particles with more variety
    const particles = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1,
      duration: 2.5 + Math.random() * 2.5,
    }));
    setConfetti(particles);

    // Auto-advance steps
    const timer1 = setTimeout(() => setStep(1), 1000);
    const timer2 = setTimeout(() => setStep(2), 3000);
    const timer3 = setTimeout(() => setStep(3), 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleClose = () => {
    localStorage.setItem('emma_launch_seen', 'true');
    onClose();
  };

  const features = [
    { icon: Package, text: 'Complete Inventory Management', color: 'var(--primary)' },
    { icon: ShoppingBag, text: 'Advanced POS System', color: 'var(--success)' },
    { icon: TrendingUp, text: 'Real-time Analytics', color: '#F59E0B' },
    { icon: Award, text: 'Role-Based Access Control', color: '#8B5CF6' },
    { icon: Heart, text: 'Expiry Date Tracking', color: '#EC4899' },
    { icon: Star, text: 'Sales & Expense Management', color: '#10B981' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Confetti Animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ y: -20, opacity: 1, rotate: 0 }}
            animate={{
              y: '100vh',
              opacity: 0,
              rotate: 360,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeIn',
            }}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              width: '10px',
              height: '10px',
              background: `hsl(${Math.random() * 360}, 70%, 60%)`,
              borderRadius: '50%',
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF9F5 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 z-10 rounded-full p-2 transition-all hover:scale-110 active:scale-95"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(10px)',
          }}
          aria-label="Close"
        >
          <X size={24} style={{ color: 'var(--text-primary)' }} />
        </button>

        <div style={{ padding: '48px 32px' }}>
          {/* Header with animated sparkles */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.8, delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div
              className="rounded-full p-6 relative"
              style={{
                background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
                boxShadow: '0 20px 60px rgba(113, 67, 41, 0.3)',
              }}
            >
              <Sparkles size={48} style={{ color: '#FFFFFF' }} />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
                }}
              />
            </div>
          </motion.div>

          {/* Main Title */}
          <AnimatePresence mode="wait">
            {step >= 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-8"
              >
                <motion.h1
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), #8B5CF6, #EC4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontSize: 'clamp(32px, 8vw, 48px)',
                    fontWeight: '800',
                    letterSpacing: '-0.02em',
                    marginBottom: '16px',
                  }}
                >
                  🎉 System Launch!
                </motion.h1>
                <p
                  className="text-xl"
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: '600',
                  }}
                >
                  December 23, 2025
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Congratulations Message */}
          <AnimatePresence mode="wait">
            {step >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl mb-8 text-center"
                style={{
                  background: 'linear-gradient(135deg, #FFF9F5, #FFE8D9)',
                  padding: '32px 24px',
                  border: '2px solid var(--secondary)',
                }}
              >
                <Award size={40} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
                <h2
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '24px',
                    fontWeight: '700',
                    marginBottom: '12px',
                  }}
                >
                  Congratulations, Menal Kids! 🌟
                </h2>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.7',
                    fontSize: '16px',
                  }}
                >
                  Your dedication and vision have brought this moment to life. Today marks the beginning of a new era in managing your beautiful business with elegance, efficiency, and excellence.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features Grid */}
          <AnimatePresence mode="wait">
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <h3
                  className="text-center mb-6"
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '20px',
                    fontWeight: '600',
                  }}
                >
                  ✨ Your Complete System Includes
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="flex items-center gap-3 rounded-xl"
                      style={{
                        backgroundColor: 'var(--background)',
                        padding: '16px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        className="rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: `${feature.color}15`,
                        }}
                      >
                        <feature.icon size={20} style={{ color: feature.color }} />
                      </div>
                      <p
                        className="text-sm"
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: '500',
                        }}
                      >
                        {feature.text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Motivation Message */}
          <AnimatePresence mode="wait">
            {step >= 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl text-center mb-8"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
                  padding: '32px 24px',
                  boxShadow: '0 20px 60px rgba(113, 67, 41, 0.2)',
                }}
              >
                <Heart size={36} style={{ color: '#FFFFFF', margin: '0 auto 16px' }} />
                <p
                  style={{
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: '600',
                    lineHeight: '1.7',
                    marginBottom: '8px',
                  }}
                >
                  "Your success story starts now. Dream big, sell smart, and grow beautifully."
                </p>
                <p
                  style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '14px',
                  }}
                >
                  Here's to efficiency, growth, and endless possibilities! 🚀
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Developer Credit */}
          <AnimatePresence mode="wait">
            {step >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-center mb-6"
              >
                <div
                  className="inline-block rounded-full px-6 py-3"
                  style={{
                    background: 'linear-gradient(135deg, var(--secondary), #FFE8D9)',
                    border: '1px solid var(--primary)',
                  }}
                >
                  <p
                    className="text-sm"
                    style={{
                      color: 'var(--text-secondary)',
                      marginBottom: '4px',
                    }}
                  >
                    Crafted with passion by
                  </p>
                  <p
                    style={{
                      color: 'var(--primary)',
                      fontSize: '18px',
                      fontWeight: '700',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Arefat Mohammed
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button */}
          <AnimatePresence mode="wait">
            {step >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-center"
              >
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-xl px-8 py-4 transition-all shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), #8B5CF6)',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 10px 40px rgba(113, 67, 41, 0.3)',
                  }}
                >
                  Let's Get Started! 🎯
                </motion.button>
                <p
                  className="text-xs mt-4"
                  style={{
                    color: 'var(--text-secondary)',
                  }}
                >
                  This message will only appear once. Make it count! 💫
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Shine Effect */}
        <motion.div
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 1,
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '50%',
            height: '4px',
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          }}
        />
      </div>
    </motion.div>
  );
}