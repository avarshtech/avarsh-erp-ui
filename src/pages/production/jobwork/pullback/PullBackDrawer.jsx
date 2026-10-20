import { useEffect, useState } from 'react';
import {
  App, Drawer, Empty, Result, Select, Skeleton, Space, Typography,
} from 'antd';
import { getPullBack, getPullBackForm } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { searchJobs } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { errorText } from '../../../../utils/apiError';
import { PULLBACK_STATUS } from '../../../../utils/jobWorkTracker/constants';
import { PullBackStatusTag } from '../components/JwTags';
import { PullBackSteps } from './PullBackHeader';
import PullBackRequestForm from './PullBackRequestForm';
import PullBackView from './PullBackView';

const { Text } = Typography;
const EDITABLE = [PULLBACK_STATUS.DRAFT, PULLBACK_STATUS.REFERRED_BACK];

/**
 * One pull-back. `target` = { id } to open one, { jobId } to raise one on a job, { jobId: null } to
 * pick the job first. A draft or referred-back request opens as the form; anything later as the view.
 */
const PullBackDrawer = ({ target, onClose, actions, refresh }) => {
  const { message } = App.useApp();
  const [id, setId] = useState(target.id ?? null);
  const [jobId, setJobId] = useState(target.jobId ?? null);
  const [pb, setPb] = useState(null);
  const [form, setForm] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id || jobId) return;
    searchJobs({ status: 'OPEN', size: 100 }).then((p) => setJobs(p.content.filter((j) => !j.openPullBack))).catch(() => setJobs([]));
  }, [id, jobId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (id) {
        const p = await getPullBack(id);
        const f = EDITABLE.includes(p.status) ? await getPullBackForm(p.jobId) : null;
        if (alive) { setPb(p); setForm(f); setError(null); }
      } else if (jobId) {
        const f = await getPullBackForm(jobId);
        if (!alive) return;
        if (f.openPullBack) {
          message.info(`${f.openPullBack.pbNo} is already open on this job.`);
          setId(f.openPullBack.id);
        } else setForm(f);
      }
    };
    load().catch((e) => { if (alive) setError(errorText(e, 'Could not load the pull-back.')); });
    return () => { alive = false; };
  }, [id, jobId, refresh, message]);

  const saved = (newId) => { setId(newId); actions.changed(); };
  const editing = (!id && form) || (pb && EDITABLE.includes(pb.status) && form);
  const name = pb ? `${pb.pbNo} · ${pb.vendor.name}` : form && `Pull back from ${form.vendorName}`;
  const title = (
    <Space wrap>
      <Text strong>{name || 'Raise a pull-back'}</Text>
      {pb && <PullBackStatusTag status={pb.status} />}
      {form && !pb && <Text type="secondary">{form.jobNo} · {form.orderNo} {form.styleNo}</Text>}
    </Space>
  );

  let body;
  if (error) body = <Result status="warning" title={error} />;
  else if (!id && !jobId) {
    body = (
      <>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Pick the open job to take work back from. Jobs that already have an open pull-back are not listed.</Text>
        {jobs === null ? <Skeleton active /> : jobs.length ? (
          <Select name="pbJob" showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Job" onChange={setJobId}
            options={jobs.map((j) => ({ value: j.id, label: `${j.jobNo} — ${j.vendorName} — ${j.orderNo} ${j.styleNo}` }))} />
        ) : <Empty description="No open job without an open pull-back." />}
      </>
    );
  } else if (editing) body = <PullBackRequestForm key={pb?.id || 'new'} form={form} pb={pb} onSaved={saved} />;
  else if (pb) body = <PullBackView pb={pb} actions={actions} refresh={refresh} />;
  else body = <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <Drawer open size={1040} destroyOnHidden onClose={onClose} title={title}>
      <PullBackSteps status={pb?.status || PULLBACK_STATUS.DRAFT} history={pb?.history} />
      {body}
    </Drawer>
  );
};

export default PullBackDrawer;
