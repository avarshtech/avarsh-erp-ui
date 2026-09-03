import { useState, useEffect, useCallback } from 'react';
import {
  getDispatch, listDispatchableSrs, listDispatchableCustomers,
} from '../../../services/sr/srService';
import { getBuyerById } from '../../../services/master/buyerService';
import { DISPATCH_STATUS } from '../../../utils/sampleRequestConstants';
import { toastUnlessHandled } from '../../../utils/apiError';

/** One frozen array, so "nothing to show" is a stable reference across renders. */
const EMPTY = Object.freeze([]);

/**
 * Everything DispatchForm reads before the user touches anything: the dispatch
 * being edited, the customers with something waiting, that customer's
 * dispatchable requests, and — for a hand delivery — that buyer's own shipping
 * locations, which are the buying offices on offer.
 *
 * The loads are reactive rather than imperative: picking a customer sets
 * `buyerId` and the requests and locations follow. The dispatchable list is
 * asked for with the draft's own id, so the server leaves this dispatch's
 * requests in it — the screen no longer merges them back in by hand.
 *
 * Both "is it loading" and "is it stale" are DERIVED from which key the last
 * answer was for, not stored: a request in flight for a different customer must
 * never let the previous customer's rows show as if they were this one's.
 */
const useDispatchFormData = ({ id, message }) => {
  const [loading, setLoading] = useState(Boolean(id));
  const [record, setRecord] = useState(null);
  const [buyerId, setBuyerId] = useState(undefined);

  const [customers, setCustomers] = useState(EMPTY);
  const [customersLoading, setCustomersLoading] = useState(true);

  const [srRows, setSrRows] = useState(EMPTY);
  const [srsLoadedFor, setSrsLoadedFor] = useState(null);

  const [locations, setLocations] = useState(EMPTY);
  const [locationsLoadedFor, setLocationsLoadedFor] = useState(null);

  // Customers — one call, independent of everything else on the screen
  useEffect(() => {
    let cancelled = false;
    listDispatchableCustomers()
      .then((rows) => { if (!cancelled) setCustomers(rows); })
      .catch((e) => { if (!cancelled) toastUnlessHandled(message, e, 'Failed to load customers'); })
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  }, [message]);

  // The dispatch being edited
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    getDispatch(id)
      .then((d) => {
        if (cancelled) return;
        setRecord(d);
        setBuyerId(d.buyerId);
      })
      .catch((e) => { if (!cancelled) toastUnlessHandled(message, e, 'Failed to load dispatch'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, message]);

  // Requests this customer could still ship. A dispatched record is immutable,
  // so it never asks — the form redirects it to the read-only dialog anyway.
  const dispatchId = record?.id;
  const wantsSrs = buyerId != null && record?.status !== DISPATCH_STATUS.DISPATCHED;
  const srKey = wantsSrs ? `${buyerId}:${dispatchId ?? ''}` : null;
  useEffect(() => {
    if (!srKey) return undefined;
    let cancelled = false;
    listDispatchableSrs(buyerId, dispatchId)
      .then((rows) => { if (!cancelled) { setSrRows(rows); setSrsLoadedFor(srKey); } })
      .catch((e) => {
        if (cancelled) return;
        toastUnlessHandled(message, e, 'Failed to load dispatchable SRs');
        // Mark the key answered anyway: a failed load leaves an empty table,
        // not a spinner that never stops.
        setSrRows(EMPTY);
        setSrsLoadedFor(srKey);
      });
    return () => { cancelled = true; };
  }, [srKey, buyerId, dispatchId, message]);

  // The buying offices of a hand delivery are the buyer's own shipping
  // locations; the server snapshots the label from the id sent with the draft.
  useEffect(() => {
    if (buyerId == null) return undefined;
    let cancelled = false;
    getBuyerById(buyerId)
      .then((buyer) => {
        if (cancelled) return;
        setLocations((buyer?.shippingLocations || []).filter((l) => l.active !== false));
        setLocationsLoadedFor(buyerId);
      })
      .catch(() => {
        if (cancelled) return;
        setLocations(EMPTY);
        setLocationsLoadedFor(buyerId);
      });
    return () => { cancelled = true; };
  }, [buyerId]);

  /** Adopt the record a save just returned — its version is what the next save sends. */
  const adopt = useCallback((saved) => {
    setRecord(saved);
    setBuyerId(saved?.buyerId);
  }, []);

  const srsReady = srsLoadedFor === srKey;
  const locationsReady = locationsLoadedFor === buyerId;

  return {
    loading,
    record,
    adopt,
    buyerId,
    setBuyerId,
    customers,
    customersLoading,
    srRows: srsReady ? srRows : EMPTY,
    srsLoading: Boolean(srKey) && !srsReady,
    locations: locationsReady ? locations : EMPTY,
    locationsLoading: buyerId != null && !locationsReady,
  };
};

export default useDispatchFormData;
