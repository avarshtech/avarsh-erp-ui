import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Drawer, Result, Skeleton, Space, Tabs, Tooltip, Typography,
} from 'antd';
import {
  FileTextOutlined, InboxOutlined, SendOutlined, StopOutlined,
} from '@ant-design/icons';
import { cancelJobOrder, closeJobOrder, getJobOrder } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { getStatusReport } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { buildStatusReportHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { errorText, toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import ReasonModal from '../../components/ReasonModal';
import { JobOrderStatusTag } from '../components/InwardTags';
import JobOrderHeader from './JobOrderHeader';
import JobOrderMaterials from './JobOrderMaterials';
import JobOrderProgress from './JobOrderProgress';
import JobOrderDocs from './JobOrderDocs';
import JobOrderProduction from './JobOrderProduction';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;
const KEY = 'production-job-work';

/** One principal's job order: terms, materials, progress, documents, production; close or cancel it. */
const JobOrderDrawer = ({ id, onClose, actions, refresh }) => {
  const { message } = App.useApp();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let alive = true;
    getJobOrder(id).then((v) => { if (alive) { setView(v); setError(null); } })
      .catch((e) => { if (alive) setError(errorText(e, 'Could not load the job order.')); });
    return () => { alive = false; };
  }, [id, refresh]);

  const printStatus = async () => {
    try {
      const d = await getStatusReport(id);
      actions.openPrint({ title: `Status report — ${d.jobOrder.orderNo}`, html: buildStatusReportHtml(d) });
    } catch (e) { toastUnlessHandled(message, e); }
  };
  const act = (fn, done) => async (reason) => {
    await fn(id, { reason });
    message.success(done);
    actions.changed();
  };

  const row = view?.row;
  const open = row?.open;
  const check = view?.closeCheck;
  const extra = row && (
    <Space wrap>
      {open && <Button icon={<InboxOutlined />} disabled={!hasPermission(KEY, 'receive')} onClick={() => actions.recordInward(id)}>Material in</Button>}
      {open && <Button icon={<SendOutlined />} disabled={!hasPermission(KEY, 'receive')} onClick={() => actions.newReturn(id)}>Return to principal</Button>}
      <Button icon={<FileTextOutlined />} onClick={printStatus}>Status report</Button>
      {open && view.cancellable && <Button danger onClick={() => setModal('cancel')} disabled={!hasPermission(KEY, 'cancel')}>Cancel order</Button>}
      {open && !view.cancellable && (
        <Tooltip title={check.blockers.length ? check.blockers.join(' ') : undefined}>
          <Button danger icon={<StopOutlined />} disabled={!hasPermission(KEY, 'cancel') || check.blockers.length > 0} onClick={() => setModal('close')}>Close</Button>
        </Tooltip>
      )}
    </Space>
  );
  const tabs = view ? [
    { key: 'materials', label: 'Materials', children: <JobOrderMaterials view={view} /> },
    { key: 'progress', label: 'Progress', children: <JobOrderProgress view={view} /> },
    { key: 'docs', label: `Material in & returns (${view.inwards.length + view.returns.length})`, children: <JobOrderDocs view={view} openPrint={actions.openPrint} /> },
    { key: 'production', label: 'Production & history', children: <JobOrderProduction view={view} onOpenOutwardJob={actions.openOutwardJob} /> },
  ] : [];

  return (
    <Drawer open size={1100} destroyOnHidden onClose={onClose} extra={extra}
      title={row ? <Space size={8}><Text strong style={{ whiteSpace: 'nowrap' }}>{row.orderNo}</Text><JobOrderStatusTag status={row.status} /></Space> : 'Job order'}>
      {error && <Result status="warning" title={error} />}
      {!view && !error && <Skeleton active paragraph={{ rows: 10 }} />}
      {view && (
        <>
          <JobOrderHeader view={view} />
          <Tabs style={{ marginTop: 12 }} items={tabs} />
        </>
      )}
      {modal === 'close' && (
        <ReasonModal title={`Close ${row.orderNo}`} okText="Close the order" required={check.piecesOut > 0}
          placeholder={check.piecesOut > 0 ? 'Why are the remaining pieces not coming back?' : 'Anything to note (optional)'}
          onSubmit={act(closeJobOrder, `${row.orderNo} closed.`)} onClose={() => setModal(null)}>
          <Alert type={check.piecesOut > 0 ? 'warning' : 'success'} showIcon
            title={check.piecesOut > 0 ? `${fmtQty(check.piecesOut)} pieces are not back: this is a short-close.` : 'Everything is back, billed and nothing of theirs is left with us.'}
            description={`Fabric variance on this order: ${fmtQty(check.variance)} kg — it goes on the closing statement.`} />
        </ReasonModal>
      )}
      {modal === 'cancel' && (
        <ReasonModal title={`Cancel ${row.orderNo}`} okText="Cancel the order" placeholder="Why is the order cancelled?"
          onSubmit={act(cancelJobOrder, `${row.orderNo} cancelled.`)} onClose={() => setModal(null)} />
      )}
    </Drawer>
  );
};

export default JobOrderDrawer;
