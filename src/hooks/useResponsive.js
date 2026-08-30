import { useState, useEffect } from 'react';

/**
 * Breakpoints aligned with Ant Design's grid system:
 * - Mobile:  < 576px   (phones)
 * - Tablet:  576–992px (tablets, factory floor devices)
 * - Desktop: > 992px   (office workstations)
 */
const BREAKPOINTS = {
  mobile: 576,
  tablet: 992,
};

const getDeviceState = () => {
  const width = window.innerWidth;
  return {
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    // Convenience: true when NOT desktop (mobile OR tablet)
    isMobileOrTablet: width < BREAKPOINTS.tablet,
    width,
  };
};

const useResponsive = () => {
  const [state, setState] = useState(getDeviceState);

  useEffect(() => {
    let rafId = null;

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setState(getDeviceState());
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return state;
};

export default useResponsive;
