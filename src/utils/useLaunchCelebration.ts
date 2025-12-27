import { useState, useEffect } from 'react';

export function useLaunchCelebration() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if user has already seen the launch celebration
    const hasSeenLaunch = localStorage.getItem('emma_launch_seen');
    
    if (hasSeenLaunch === 'true') {
      setShouldShow(false);
      return;
    }

    // Check if current date is between Dec 23-25, 2025
    const now = new Date();
    const launchStart = new Date('2025-12-23T00:00:00');
    const launchEnd = new Date('2025-12-25T23:59:59');

    if (now >= launchStart && now <= launchEnd) {
      setShouldShow(true);
    } else {
      setShouldShow(false);
    }
  }, []);

  const markAsSeen = () => {
    localStorage.setItem('emma_launch_seen', 'true');
    setShouldShow(false);
  };

  return { shouldShow, markAsSeen };
}
