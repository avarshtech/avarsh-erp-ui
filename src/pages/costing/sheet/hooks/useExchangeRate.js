import { useEffect, useState } from 'react';
import { getLiveRate, getStoredRate } from '../../../../services/costing/exchangeRateService';

// What CostSheetService falls back to when no USD→INR rate is stored; matching it keeps the
// live panel equal to what the server saves.
const SERVER_DEFAULT_USD_INR = 83.8;

/**
 * Today's rate for the quote→costing currencies — live from the exchange API, or the server's
 * stored rate when the API cannot be reached — and the server's stored USD→INR rate, which the
 * server works the USD price out with (so the live panel keeps equal to what is saved).
 */
export default function useExchangeRate(currency, quoteCurrency) {
  const key = `${quoteCurrency}>${currency}`;
  const [state, setState] = useState({ key: null, quote: null, usd: null, usdToday: null });

  useEffect(() => {
    if (!currency || !quoteCurrency) return undefined;
    let cancelled = false;
    const today = (from, to) => getLiveRate(from, to).then((live) => live || getStoredRate(from, to));
    Promise.all([today(quoteCurrency, currency), getStoredRate('USD', 'INR'), today('USD', 'INR')])
      .then(([quote, usd, usdToday]) => { if (!cancelled) setState({ key, quote, usd, usdToday }); });
    return () => { cancelled = true; };
  }, [key, currency, quoteCurrency]);

  const ready = state.key === key;
  return {
    ready,
    todaysRate: ready ? state.quote?.rate ?? null : null,
    rateDate: ready ? state.quote?.date ?? null : null,
    rateSource: ready ? state.quote?.source ?? null : null,
    missing: ready && !state.quote,
    usdRate: ready ? state.usdToday?.rate ?? null : null,
    usdRateDate: ready ? state.usdToday?.date ?? null : null,
    usdRateSource: ready ? state.usdToday?.source ?? null : null,
    usdToInrRate: Number(state.usd?.rate) || SERVER_DEFAULT_USD_INR,
  };
}
