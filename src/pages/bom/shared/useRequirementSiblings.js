import { useEffect, useState } from 'react';

const NONE = [];

/**
 * The order's other requirements (CPR WRN-07, GPR OP-2), refetched when the order or the
 * document changes. Kept per order: another order's list never shows, and a response
 * that arrives after the order changed again is dropped.
 */
const useRequirementSiblings = (forOrder, orderId, docId) => {
  const [result, setResult] = useState({ orderId: null, list: NONE });

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    forOrder(orderId, docId)
      .then((list) => { if (alive) setResult({ orderId, list }); })
      .catch(() => { if (alive) setResult({ orderId, list: NONE }); });
    return () => { alive = false; };
  }, [forOrder, orderId, docId]);

  return result.orderId === orderId ? result.list : NONE;
};

export default useRequirementSiblings;
