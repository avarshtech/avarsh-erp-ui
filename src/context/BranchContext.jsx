import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getActiveBranches } from '../services/master/branchService';

/**
 * The company's branches and which one the user is currently working in.
 *
 * A single-branch company must never see the branch layer, so there is no
 * configuration flag: `isMultiBranch` is simply "more than one active branch",
 * and every screen that shows a branch switcher, field or column keys off it.
 *
 * `activeBranchId` is the header switcher's choice — null means "all branches"
 * and is the only value a single-branch company ever holds. `effectiveBranchId`
 * is what a NEW document should default to: the active branch, else the head
 * office. The two differ on purpose: a list filtered to "all" still creates its
 * documents somewhere.
 */
const STORAGE_KEY = 'activeBranchId';
const BranchContext = createContext(null);

const readStored = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
};

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeBranchId, setActiveBranchIdState] = useState(readStored);

  const refresh = useCallback(async () => {
    try {
      const { data } = await getActiveBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch {
      // axiosInstance already toasted. An empty list behaves as single-branch.
      setBranches([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setActiveBranch = useCallback((id) => {
    setActiveBranchIdState(id ?? null);
    try {
      if (id == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // storage unavailable — the choice just does not survive a reload
    }
  }, []);

  // A remembered branch that has since been deactivated falls back to "all".
  useEffect(() => {
    if (loaded && activeBranchId != null && !branches.some((b) => b.id === activeBranchId)) {
      setActiveBranch(null);
    }
  }, [loaded, branches, activeBranchId, setActiveBranch]);

  const value = useMemo(() => {
    const defaultBranch = branches.find((b) => b.isHeadOffice) || branches[0] || null;
    const activeBranch = branches.find((b) => b.id === activeBranchId) || null;
    return {
      branches,
      loaded,
      isMultiBranch: branches.length > 1,
      defaultBranch,
      activeBranchId,
      activeBranch,
      effectiveBranchId: activeBranchId ?? defaultBranch?.id ?? null,
      branchName: (id) => branches.find((b) => b.id === id)?.branchName || '—',
      setActiveBranch,
      refresh,
    };
  }, [branches, loaded, activeBranchId, setActiveBranch, refresh]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
};

export default BranchContext;
