import { memo, useEffect, useState } from 'react';
import { Drawer, Skeleton } from 'antd';
import ActivityTimeline from './ActivityTimeline';

/** Fetches on mount — the drawer destroys it on close, so every opening shows fresh rows. */
const HistoryContent = ({ docId, loadAudit }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    loadAudit(docId).then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [docId, loadAudit]);
  return rows === null
    ? <Skeleton active paragraph={{ rows: 6 }} />
    : <ActivityTimeline activities={rows} maxHeight="calc(100vh - 140px)" emptyText="No history yet" />;
};

/**
 * Audit trail of a document (process requirements, job-work POs): every save and status
 * change, with quantity or field changes and reasons. `loadAudit(id)` resolves to
 * [{ id, type: 'user' | 'system', user, action, details, timestamp }], newest first.
 */
const DocumentHistoryDrawer = memo(function DocumentHistoryDrawer({ open, onClose, docId, docNo, loadAudit }) {
  return (
    <Drawer title={`History — ${docNo || 'New document'}`} open={open} onClose={onClose} size={480} destroyOnHidden>
      {open && docId ? <HistoryContent docId={docId} loadAudit={loadAudit} /> : null}
    </Drawer>
  );
});

export default DocumentHistoryDrawer;
