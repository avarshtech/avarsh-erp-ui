import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Drawer, Result, Skeleton, Space, Tabs, Typography,
} from 'antd';
import { EditOutlined, InboxOutlined, StopOutlined, SwapOutlined } from '@ant-design/icons';
import { getJob } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { deleteProgress } from '../../../../services/production/jobwork/jobWorkSheetApi';
import { getJobMaterials } from '../../../../services/production/jobwork/jobWorkMaterialsApi';
import { hasPermission } from '../../../../utils/permissions';
import { errorText, toastUnlessHandled } from '../../../../utils/apiError';
import { OPEN_JOB_STATUSES } from '../../../../utils/jobWorkTracker/constants';
import JobHeaderCard from './JobHeaderCard';
import JobStageGrid from './JobStageGrid';
import JobTimeline from './JobTimeline';
import JobReceiptsList from './JobReceiptsList';
import JobMaterialsCard from './JobMaterialsCard';
import JobSharesCard from './JobSharesCard';
import JobScopeSwitches from './JobScopeSwitches';
import JobDocsTable from './JobDocsTable';
import JobCloseModal from './JobCloseModal';
import { JobStatusTag } from '../components/JwTags';

const { Text } = Typography;
const KEY = 'production-job-work';

/** One job: who and when, the colour × stage grid, the timeline, receipts, materials, pay and scope. */
const JobViewDrawer = ({ jobId, onClose, actions, refresh }) => {
  const { message } = App.useApp();
  const [view, setView] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getJob(jobId), getJobMaterials(jobId)])
      .then(([v, m]) => { if (alive) { setView(v); setMaterials(m.rows); setError(null); } })
      .catch((e) => { if (alive) setError(errorText(e, 'Could not load the job.')); });
    return () => { alive = false; };
  }, [jobId, refresh, tick]);

  const changed = useCallback(() => { setTick((t) => t + 1); actions.changed(); }, [actions]);

  const deleteLatest = async () => {
    setDeleting(true);
    try {
      await deleteProgress(view.latestEntryId, { version: view.latestEntryVersion });
      message.success('Latest update deleted.');
      changed();
    } catch (e) { toastUnlessHandled(message, e, 'Could not delete the update.'); } finally { setDeleting(false); }
  };

  const row = view?.row;
  const open = row && OPEN_JOB_STATUSES.includes(row.status);
  const extra = row && (
    <Space wrap>
      {open && <Button icon={<EditOutlined />} onClick={() => actions.openDaily(row.vendorId)} disabled={!hasPermission(KEY, 'add')}>Daily update</Button>}
      {open && <Button icon={<InboxOutlined />} onClick={() => actions.openReceipt(row.id)} disabled={!hasPermission(KEY, 'receive')}>Receive</Button>}
      {row.openPullBack
        ? <Button icon={<SwapOutlined />} onClick={() => actions.openPullBack({ id: row.openPullBack.id })}>{row.openPullBack.pbNo}</Button>
        : open && <Button icon={<SwapOutlined />} onClick={() => actions.openPullBack({ jobId: row.id })} disabled={!hasPermission(KEY, 'add')}>Raise pull-back</Button>}
      {open && <Button danger icon={<StopOutlined />} onClick={() => setClosing(true)} disabled={!hasPermission(KEY, 'cancel')}>Short-close</Button>}
    </Space>
  );

  const tabs = view ? [
    { key: 'progress', label: 'Progress', children: <JobStageGrid grid={view.grid} /> },
    {
      key: 'timeline', label: 'Timeline', children: (
        <JobTimeline timeline={view.timeline} stages={view.grid.stages} latestEntryId={view.latestEntryId}
          canDelete={open && hasPermission(KEY, 'delete')} onDeleteLatest={deleteLatest} deleting={deleting} />
      ),
    },
    { key: 'receipts', label: `Receipts (${view.receipts.length})`, children: <JobReceiptsList receipts={view.receipts} finalStage={view.snapshot.finalStage} canCancel={hasPermission(KEY, 'cancel')} onChanged={changed} /> },
    { key: 'materials', label: 'Materials', children: <JobMaterialsCard rows={materials} /> },
    ...(view.shares ? [{
      key: 'pay', label: 'Pay & scope', children: (
        <>
          {view.finishing && <JobScopeSwitches jobId={view.row.id} finishing={view.finishing} canEdit={open && hasPermission(KEY, 'add')} onSaved={changed} />}
          <JobSharesCard jobId={view.row.id} shares={view.shares} earningsByStage={view.earningsByStage} canEdit={hasPermission(KEY, 'add')} onSaved={changed} />
        </>
      ),
    }] : []),
    { key: 'docs', label: 'Documents', children: <JobDocsTable docs={view.docs} /> },
  ] : [];

  return (
    <Drawer
      open
      size={1080}
      onClose={onClose}
      destroyOnHidden
      title={row ? <Space><Text strong>{row.jobNo}</Text><JobStatusTag status={row.status} /><Text type="secondary">{row.vendorName}</Text></Space> : 'Job'}
      extra={extra}
    >
      {error && <Result status="warning" title={error} />}
      {!view && !error && <Skeleton active paragraph={{ rows: 10 }} />}
      {view && (
        <>
          <JobHeaderCard view={view} />
          <Tabs style={{ marginTop: 12 }} items={tabs} />
        </>
      )}
      {closing && row && <JobCloseModal open row={row} onClose={() => setClosing(false)} onDone={() => { setClosing(false); changed(); }} />}
    </Drawer>
  );
};

export default JobViewDrawer;
