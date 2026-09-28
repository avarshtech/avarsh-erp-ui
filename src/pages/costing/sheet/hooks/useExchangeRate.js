import { useEffect, useState } from 'react';
import { getStoredRate } from '../../../../services/costing/exchangeRateService';

// What CostSheetService falls back to when no USD→INR rate is stored; matching it keeps the
// live panel equal to what the server saves.
const SERVER_DEFAULT_USD_INR = 83.8;

/**
 * The server's stored quote→costing rate (the "today's rate" hint for Actual Rate) and its
 * USD→INR rate (for the USD equivalent). Both come from the server — the same figures it saves
 * with — instead of a public API in the browser, so preview and saved totals agree.
 */
export default function useExchangeRate(currency, quoteCurrency) {
  const key = `${quoteCurrency}>${currency}`;
  const [state, setState] = useState({ key: null, quote: null, usd: null });

  useEffect(() => {
    if (!currency || !quoteCurrency) return undefined;
    let cancelled = false;
    Promise.all([getStoredRate(quoteCurrency, currency), getStoredRate('USD', 'INR')]).then(([quote, usd]) => {
      if (!cancelled) setState({ key, quote, usd });
    });
    return () => { cancelled = true; };
  }, [key, currency, quoteCurrency]);

  const ready = state.key === key;
  return {
    ready,
    todaysRate: ready ? state.quote?.rate ?? null : null,
    rateDate: ready ? state.quote?.date ?? null : null,
    missing: ready && !state.quote,
    usdToInrRate: Number(state.usd?.rate) || SERVER_DEFAULT_USD_INR,
  };
}
