import { useCallback, useEffect, useState } from 'react';
import { getVendorSheet, saveVendorSheet } from '../../../../services/production/jobwork/jobWorkSheetApi';
import { errorText } from '../../../../utils/apiError';

/** Loads one vendor's daily sheet for a date and saves it; reloads when `refresh` moves. */
const useVendorSheet = ({ vendorId, date, refresh }) => {
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!vendorId) {
      setSheet(null);
      return null;
    }
    setLoading(true);
    try {
      const s = await getVendorSheet({ vendorId, date });
      setSheet(s);
      setError(null);
      return s;
    } catch (e) {
      setError(errorText(e, 'Could not load the sheet.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorId, date]);

  useEffect(() => { reload(); }, [reload, refresh]);

  const save = useCallback(async (payload) => {
    const s = await saveVendorSheet(payload);
    setSheet(s);
    return s;
  }, []);

  return { sheet, loading, error, reload, save };
};

export default useVendorSheet;
