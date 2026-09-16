import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getActiveBranches } from '../services/master/branchService';
import { getCurrentUser } from '../services/auth/authService';

/**
 * The company's branches and which one the user is currently working in.
 *
 * A single-branch company must never see the branch layer, so there is no
 * configuration flag: `isMultiBranch` is simply "more than one active branch",
 * and every screen that shows a branch switcher, field or column keys off it.
 *
 * `activeBranchId` is the header switcher's choice — null means "all branches".
 * It starts at the user's home branch (sys_users.default_branch_id) and is then
 * remembered per browser; the stored value 'all' records that the user lifted
 * the filter on purpose, so a reload does not silently put it back.
 *
 * `effectiveBranchId` is what a NEW document should default to: the active
 * branch, else the user's home branch, else the head office. The two differ on
 * purpose — a list filtered to "all" still creates its documents somewhere.
 *
 * `allowedBranches` is what the switcher offers: the user's allow-list when one
 * is set (sys_user_branches), otherwise every active branch. Not a security
 * boundary; the server does not enforce it in this phase.
 */
const STORAGE_KEY = 'activeBranchId';
const ALL = 'all';
const BranchContext = createContext(null);

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  // True only after a fetch that succeeded: a transient failure must not read as
  // "the company has no branches" and wipe the user's remembered choice.
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState(readStored);

  // axiosInstance reads the same key to send X-Branch-Id, so this is the one place it is written.
  const setActiveBranch = useCallback((id) => {
    const next = id == null ? ALL : String(id);
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — the choice just does not survive a reload
    }
  }, []);

  // Runs each time the list is (re)fetched. A fresh browser starts at the
  // user's home branch and that choice is written down, so X-Branch-Id is sent
  // from the first request; a remembered branch that has since been
  // deactivated falls back to "all".
  const reconcileStored = useCallback((list) => {
    const current = readStored();
    if (current == null) {
      const home = getCurrentUser()?.defaultBranchId;
      setActiveBranch(list.some((b) => b.id === home) ? home : null);
    } else if (current !== ALL && !list.some((b) => b.id === Number(current))) {
      setActiveBranch(null);
    }
  }, [setActiveBranch]);

  const refresh = useCallback(() => getActiveBranches()
    .then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      setBranches(list);
      setLoaded(true);
      reconcileStored(list);
    })
    .catch(() => {
      // axiosInstance already toasted; keep whatever list we had.
    }), [reconcileStored]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => {
    const user = getCurrentUser();
    const userBranchIds = Array.isArray(user?.branchIds) ? user.branchIds : [];
    const allowedBranches = userBranchIds.length
      ? branches.filter((b) => userBranchIds.includes(b.id))
      : branches;
    const headOffice = branches.find((b) => b.isHeadOffice) || branches[0] || null;
    const userDefault = branches.find((b) => b.id === user?.defaultBranchId) || null;
    const defaultBranch = userDefault || (userBranchIds.length ? allowedBranches[0] : null) || headOffice;

    let activeBranchId = null;
    if (stored == null) activeBranchId = userDefault?.id ?? null;
    else if (stored !== ALL) activeBranchId = Number(stored);
    const activeBranch = branches.find((b) => b.id === activeBranchId) || null;

    return {
      branches,
      allowedBranches,
      loaded,
      isMultiBranch: branches.length > 1,
      defaultBranch,
      activeBranchId: activeBranch ? activeBranchId : null,
      activeBranch,
      effectiveBranchId: activeBranch?.id ?? defaultBranch?.id ?? null,
      branchName: (id) => branches.find((b) => b.id === id)?.branchName || '—',
      setActiveBranch,
      refresh,
    };
  }, [branches, loaded, stored, setActiveBranch, refresh]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
};

export default BranchContext;
