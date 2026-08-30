import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Global scroll-reset on route change.
 *
 * When the URL pathname changes, reset the scroll position of:
 *  - the browser `window` (for pages that let the body scroll)
 *  - `.ant-layout-content` (the main scroll container inside MainLayout)
 *  - any `.inv-page` page wrapper that has its own scroll context
 *
 * Mounted once inside `<BrowserRouter>` in App.jsx so every page starts at the top.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset the window (fallback for pages whose layout lets the body scroll)
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }

    // Reset the main layout content scroll container (AntD Layout)
    // This is the element that actually scrolls in MainLayout.
    const layoutContent = document.querySelector('.ant-layout-content');
    if (layoutContent) layoutContent.scrollTop = 0;

    // Reset any page wrappers that opt into .inv-page or similar
    document.querySelectorAll('.inv-page').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
