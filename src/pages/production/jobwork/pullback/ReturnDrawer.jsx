import { useCallback, useMemo, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, Input, Row, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { saveReturn } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { PULLBACK_STATUS } from '../../../../utils/jobWorkTracker/constants';
import ReturnLinesTable from './ReturnLinesTable';
import { prefillReturnRows, returnProblems, stageOptions } from './returnRows';

const { Text } = Typography;

/**
 * One truck back from the vendor on a pull-back. A draft can be saved while approval is pending;
 * posting needs the approval. Posting saves the draft first, so a refusal keeps it for correction.
 */
const ReturnDrawer = ({ pb, ret, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [date, setDate] = useState(ret?.date || dayjs().format('YYYY-MM-DD'));
  const [dc, setDc] = useState(ret?.vendorDcNo || '');
  const [rows, setRows] = useState(() => (ret ? ret.lines.map((l, i) => ({ ...l, _k: `d${i}` })) : prefillReturnRows(pb)));
  const [draftId, setDraftId] = useState(ret?.id || null);
  const [busy, setBusy] = useState(null);
  const [serverErrors, setServerErrors] = useState([]);
  const approved = pb.status === PULLBACK_STATUS.APPROVED;

  const problems = useMemo(() => returnProblems(pb, rows), [pb, rows]);
  const colours = useMemo(() => [...new Set(pb.lines.map((l) => l.colour))], [pb]);
  const onChange = useCallback((i, patch) => { setServerErrors([]); setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); }, []);
  const onRemove = useCallback((i) => setRows((rs) => rs.filter((_, j) => j !== i)), []);
  const onAdd = useCallback(() => setRows((rs) => [...rs, {
    _k: `n${Date.now()}`, colour: colours[0], size: pb.order.sizes[0], stage: pb.lines[0]?.stage, good: 0, damaged: 0, damageSource: null,
  }]), [colours, pb]);

  const save = async (post) => {
    setBusy(post ? 'post' : 'save');
    let id = draftId;
    try {
      const body = { date, vendorDcNo: dc, lines: rows };
      const draft = await saveReturn(pb.id, { ...body, id, post: false });
      id = draft.id;
      setDraftId(id);
      if (post) {
        const done = await saveReturn(pb.id, { ...body, id, post: true });
        message.success(`${done.prNo} posted${done.pullBackStatus === PULLBACK_STATUS.SETTLED ? '; everything approved is back, so the pull-back is settled' : ''}.`);
      } else message.success(`${draft.prNo} saved as a draft.`);
      onSaved();
      onClose();
    } catch (e) {
      setServerErrors(e.details || [{ message: e.message }]);
      toastUnlessHandled(message, e);
      if (id) onSaved();
    } finally { setBusy(null); }
  };

  const shown = serverErrors.length ? serverErrors : problems;
  return (
    <Drawer open size={900} destroyOnHidden onClose={onClose} title={`${draftId ? 'Return (draft)' : 'Goods back'} — ${pb.pbNo} · ${pb.vendor.name}`}
      extra={(
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button loading={busy === 'save'} disabled={!!busy || problems.length > 0} onClick={() => save(false)}>Save draft</Button>
          <Button type="primary" loading={busy === 'post'} disabled={!!busy || !approved || problems.length > 0 || !dc.trim()} onClick={() => save(true)}>Post return</Button>
        </Space>
      )}>
      {!approved && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Save it as a draft: posting waits for the manager's approval." />}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={12} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>Arrived on</Text>
          <DatePicker name="retDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
        </Col>
        <Col xs={12} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>Vendor DC no.</Text>
          <Input name="retDc" value={dc} onChange={(e) => setDc(e.target.value)} placeholder="Needed to post" />
        </Col>
        <Col xs={24} md={8}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 18 }}>
            Pre-filled with what is still expected; change it to what is on the truck.
          </Text>
        </Col>
      </Row>
      <ReturnLinesTable rows={rows} colours={colours} sizes={pb.order.sizes} stages={stageOptions(pb)}
        badColours={shown.filter((p) => p.colour).map((p) => p.colour)} onChange={onChange} onRemove={onRemove} onAdd={onAdd} />
      {shown.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={shown[0].message} description={shown.length > 1 ? shown.slice(1).map((p) => p.message).join(' ') : undefined} />}
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
        Fabric, trims and packing the vendor sends back go on a vendor material return (Goods back tab), onto the lot they left from.
      </Text>
    </Drawer>
  );
};

export default ReturnDrawer;
