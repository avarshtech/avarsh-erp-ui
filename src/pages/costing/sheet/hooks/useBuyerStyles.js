import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStylesByBuyerId } from '../../../../services/master/styleService';

/** The chosen buyer's styles as picker options ({value, label: styleNo, style}). */
export default function useBuyerStyles(buyerId) {
  const [state, setState] = useState({ buyerId: null, styles: [] });

  useEffect(() => {
    if (!buyerId) return undefined;
    let cancelled = false;
    getStylesByBuyerId(buyerId)
      .then((list) => { if (!cancelled) setState({ buyerId, styles: list || [] }); })
      .catch(() => { if (!cancelled) setState({ buyerId, styles: [] }); });
    return () => { cancelled = true; };
  }, [buyerId]);

  const current = state.buyerId === buyerId;
  const addStyle = useCallback((style) => setState((s) => ({ ...s, styles: [...s.styles, style] })), []);
  const options = useMemo(
    () => (current ? state.styles : []).map((s) => ({ value: s.id, label: s.styleNo, style: s })),
    [current, state.styles],
  );

  return { options, loading: !!buyerId && !current, addStyle };
}
