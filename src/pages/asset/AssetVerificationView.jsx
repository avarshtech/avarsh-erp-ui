import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, App, Card, Col, Input, Modal, Row, Select, Space, Spin, Statistic, Table, Tag,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import PermissionGuard from '../../components/PermissionGuard';
import RecordLink from '../../components/RecordLink';
import { ActionButton } from '../../components/buttons';
import AssetVerificationDetail from './components/AssetVerificationDetail';
import QrScanDialog from './components/QrScanDialog';
import { assetCodeFrom } from '../../utils/qrSvg';
import { toastUnlessHandled } from '../../utils/apiError';
import { closeRun, getRun, reopenRun, scanAsset } from '../../services/asset/verificationService';
import {
  ASSET_CONDITION, conditionMeta, toOptions, verificationResultMeta, VERIFICATION_STATUS,
} from '../../utils/assetConstants';

const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);
const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '-');

/**
 * Walking the floor with the list.
 *
 * <p>The scan box keeps focus and clears itself after every read, because a
 * barcode scanner is a keyboard: it types the code and presses Enter, and the
 * person holding it is looking at the machine, not the screen. Anything that
 * steals focus between scans turns a two-minute job into a twenty-minute one.</p>
 *
 * <p>The camera is the third way in, and on a phone the usual one: the labels
 * this module prints are QR codes, which a laser wedge scanner cannot read.</p>
 *
 * <p>Nothing here changes the register. Every difference is a finding for
 * somebody to act on afterwards - so each row opens to what was written down,
 * and links to the asset, which is where acting on it happens.</p>
 */
const AssetVerificationView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [adjust, setAdjust] = useState(null);
  const [camera, setCamera] = useState(false);
  const scanBox = useRef(null);

  useEffect(() => {
    let ignore = false;
    getRun(id)
      .then((loaded) => { if (!ignore) setRun(loaded); })
      .catch((e) => { if (!ignore) toastUnlessHandled(message, e, 'Could not load the run'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id, message]);

  const refresh = useCallback(async () => {
    try { setRun(await getRun(id)); } catch { /* the toast above already covered it */ }
  }, [id]);

  /** Back to the box every time, so the next scan simply lands. */
  const refocus = () => setTimeout(() => scanBox.current?.focus(), 0);

  const send = async (payload) => {
    setScanning(true);
    try {
      const found = await scanAsset(id, payload);
      const meta = verificationResultMeta(found.result);
      if (found.needsAttention) message.warning(`${found.assetCode}: ${meta.label}`);
      else message.success(`${found.assetCode}: ${meta.label}`);
      setCode('');
      await refresh();
    } catch (e) {
      // A surprise is a question, not a failure: offer to add it rather than
      // making somebody retype the code into a different box.
      const text = e?.response?.data?.message ?? '';
      if (text.includes('not expected in')) {
        modal.confirm({
          title: 'Not expected here',
          content: `${text} Add it to this run anyway?`,
          okText: 'Add it',
          onOk: () => send({ ...payload, addIfOutsideScope: true }),
          onCancel: () => { setCode(''); refocus(); },
        });
      } else {
        toastUnlessHandled(message, e, 'Could not record that scan');
        setCode('');
      }
    } finally {
      setScanning(false);
      refocus();
    }
  };

  const close = () => modal.confirm({
    title: 'Close this run?',
    content: 'Everything still unchecked will be recorded as Not found. You can reopen the run to carry on.',
    okText: 'Close run',
    onOk: async () => {
      try {
        setRun(await closeRun(id, run.version));
        message.success('Run closed');
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not close the run');
      }
    },
  });

  const reopen = async () => {
    try {
      setRun(await reopenRun(id, run.version));
      message.success('Run reopened — the missing are pending again');
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not reopen the run');
    }
  };

  const columns = [
    {
      title: 'Asset ID',
      dataIndex: 'assetCode',
      width: 190,
      // A finding is only useful if you can get to the machine it is about.
      // Raising the transfer or the disposal it calls for happens over there.
      render: (v, r) => (
        <RecordLink
          text={v}
          onClick={(e) => { e?.stopPropagation?.(); navigate(`/assets/${r.assetId}`); }}
        />
      ),
    },
    { title: 'Name', dataIndex: 'assetName' },
    { title: 'Expected at', dataIndex: 'expectedLocationText', width: 220 },
    {
      title: 'Found at',
      dataIndex: 'actualLocationText',
      width: 220,
      render: (v, r) => (r.result === 'PENDING' ? <span style={{ opacity: 0.45 }}>—</span> : v || '-'),
    },
    {
      title: 'Condition',
      key: 'condition',
      width: 180,
      render: (_, r) => (r.actualCondition && r.actualCondition !== r.expectedCondition
        ? (
          <>
            <Tag color={conditionMeta(r.expectedCondition).color}>{conditionMeta(r.expectedCondition).label}</Tag>
            <span style={{ opacity: 0.45 }}>→</span>
            <Tag color={conditionMeta(r.actualCondition).color}>{conditionMeta(r.actualCondition).label}</Tag>
          </>
        )
        : <Tag color={conditionMeta(r.expectedCondition).color}>{conditionMeta(r.expectedCondition).label}</Tag>),
    },
    {
      title: 'Result',
      dataIndex: 'result',
      width: 220,
      // The row's result is one value, so a machine that moved AND is damaged
      // showed only the move. The second finding is named beside it.
      render: (v, r) => (
        <>
          <Tag color={verificationResultMeta(v).color}>{verificationResultMeta(v).label}</Tag>
          {r.conditionDiffers && v !== 'CONDITION_CHANGED' && (
            <Tag color="orange">condition differs too</Tag>
          )}
        </>
      ),
    },
    { title: 'Checked', dataIndex: 'verifiedAt', width: 150, render: stamp },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 220,
      ellipsis: true,
      // A preview only - the row opens to the whole of it. This column had no
      // existence at all, so what the verifier wrote was stored and never read.
      render: (v) => v || <span style={{ opacity: 0.45 }}>&mdash;</span>,
    },
  ];

  // Both halves of this pair depend on which state the run is in, so neither
  // may render before the run is here: until then it showed Reopen, then
  // changed to Close run under the reader.
  const isOpen = run?.status === 'OPEN';
  const counts = run?.counts ?? {};

  /**
   * What the register claims about the code in the box.
   *
   * Recording a difference without it is recording a difference from something
   * you cannot see: the dialog asked "where it actually is" against a list the
   * verifier had to scroll back to. Undefined for a surprise, which is itself
   * worth saying out loud.
   */
  const expectedFor = (assetCode) => run?.items?.find((i) => i.assetCode === assetCode) ?? null;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={run?.runNo ?? 'Verification run'}
        subtitle={run && `${run.name} — ${run.scopeText}`}
        status={run && (
          <Tag color={VERIFICATION_STATUS[run.status]?.color}>{VERIFICATION_STATUS[run.status]?.label}</Tag>
        )}
        onBack={() => navigate('/assets/verification')}
      >
        {run && (
          <PermissionGuard module="asset-verification" operation="lock">
            {isOpen
              ? <ActionButton action="lock" text="Close run" onClick={close} />
              : <ActionButton action="undo" text="Reopen" onClick={reopen} />}
          </PermissionGuard>
        )}
      </PageHeader>

      <Spin spinning={loading}>
        {run && (
          <>
            {isOpen && (
              <Card style={{ marginBottom: 16 }}>
                <PermissionGuard module="asset-verification" operation="verify">
                  <Row gutter={16} align="bottom">
                    <Col xs={24} md={10}>
                      <div style={{ marginBottom: 4, fontWeight: 500 }}>Scan or type an asset ID</div>
                      <Input.Search
                        ref={scanBox}
                        autoFocus
                        value={code}
                        loading={scanning}
                        enterButton="Found it"
                        placeholder="SEWINGMACH-U1-01001"
                        onChange={(e) => setCode(e.target.value)}
                        onSearch={(v) => {
                          // Our own labels carry a URL; a 2D scanner types the
                          // whole of it. Take the code out of whatever arrives.
                          const scanned = assetCodeFrom(v);
                          if (scanned) send({ assetCode: scanned, addIfOutsideScope: false });
                        }}
                      />
                    </Col>
                    <Col xs={24} md={14}>
                      <div style={{ opacity: 0.65, fontSize: 12, paddingBottom: 6 }}>
                        Scan each machine as you reach it — with the camera, with a scanner (which types the
                        code and presses Enter), or by typing the ID off the label. Use
                        <strong> Record a difference</strong> only when what you see is not what the list says.
                      </div>
                      <Space wrap>
                        {/* A printed label is a QR, which a laser wedge scanner
                            cannot read at all. The camera is the way in for
                            anybody walking the floor with a phone. */}
                        <ActionButton
                          action="custom"
                          text="Scan with camera"
                          onClick={() => setCamera(true)}
                        />
                        <ActionButton
                          action="custom"
                          text="Record a difference"
                          disabled={!code.trim()}
                          onClick={() => {
                            const scanned = assetCodeFrom(code);
                            setAdjust({ assetCode: scanned, expected: expectedFor(scanned) });
                          }}
                        />
                      </Space>
                    </Col>
                  </Row>
                </PermissionGuard>
              </Card>
            )}

            <Card style={{ marginBottom: 16 }}>
              <Space size="large" wrap>
                {/* What the run froze at the start. A surprise is a row too,
                    so counting rows here would say the scope expected one more
                    machine every time somebody found one it never listed. */}
                <Statistic title="Expected" value={run.total - (counts.EXTRA ?? 0)} />
                <Statistic title="Still to find" value={counts.PENDING ?? 0} />
                <Statistic title="As expected" value={counts.OK ?? 0} />
                {/* These two count findings, not rows: a machine both moved and
                    damaged is in both, where before the damage was in neither
                    because its row could only carry one result. */}
                <Statistic title="Elsewhere" value={counts.FOUND_ELSEWHERE ?? 0}
                  styles={{ content: { color: (counts.FOUND_ELSEWHERE ?? 0) > 0 ? '#d46b08' : undefined } }} />
                <Statistic title="Condition differs" value={counts.CONDITION_DIFFERS ?? 0}
                  styles={{ content: { color: (counts.CONDITION_DIFFERS ?? 0) > 0 ? '#d46b08' : undefined } }} />
                <Statistic title="Not found" value={counts.NOT_FOUND ?? 0}
                  styles={{ content: { color: (counts.NOT_FOUND ?? 0) > 0 ? '#cf1322' : undefined } }} />
                <Statistic title="Surprises" value={counts.EXTRA ?? 0} />
              </Space>
            </Card>

            {!isOpen && (counts.NOT_FOUND ?? 0) > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`${counts.NOT_FOUND} asset(s) were never found`}
                description="Nothing has been changed on the register. Reopen the run if the count was simply unfinished, or follow each one up with a transfer or a disposal."
                style={{ marginBottom: 16 }}
              />
            )}

            <Card title="The list">
              <Table
                columns={columns}
                dataSource={run.items}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content', y: 520 }}
                rowClassName={(r) => (r.needsAttention ? 'row-needs-attention' : '')}
                expandable={{
                  expandedRowRender: (row) => <AssetVerificationDetail row={row} />,
                  expandRowByClick: true,
                }}
              />
            </Card>

            <QrScanDialog
              open={camera}
              onClose={() => { setCamera(false); refocus(); }}
              onRead={(scanned) => {
                // Straight through: a scan that has to be confirmed is not a
                // scan. The usual refusals still raise their own dialogs.
                setCamera(false);
                setCode(scanned);
                send({ assetCode: scanned, addIfOutsideScope: false });
              }}
            />

            <Modal
              title={`Record a difference — ${adjust?.assetCode ?? ''}`}
              open={!!adjust}
              onCancel={() => { setAdjust(null); refocus(); }}
              onOk={() => {
                // `expected` is what the dialog shows, not something to send.
                const { expected, ...payload } = adjust;
                send({ ...payload, addIfOutsideScope: false });
                setAdjust(null);
              }}
              okText="Record it"
              destroyOnHidden
            >
              <p style={{ marginTop: 0, opacity: 0.7 }}>
                This records what you found. It does not change the asset — somebody decides that afterwards.
              </p>
              {adjust?.expected ? (
                <Alert
                  type="info"
                  style={{ marginBottom: 12 }}
                  title={adjust.expected.assetName}
                  description={(
                    <>
                      The register has it at <strong>{adjust.expected.expectedLocationText}</strong>,
                      in <strong>{conditionMeta(adjust.expected.expectedCondition).label}</strong> condition.
                      Fill in only what differs.
                    </>
                  )}
                />
              ) : (
                <Alert
                  type="warning"
                  style={{ marginBottom: 12 }}
                  title="Not on this run's list"
                  description="Nothing with that ID is expected in this scope, so recording it will ask you to confirm it as a surprise."
                />
              )}
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Where it actually is</div>
                <Input
                  placeholder="Leave blank if it is where the list says"
                  maxLength={250}
                  onChange={(e) => setAdjust((a) => ({ ...a, actualLocationText: e.target.value }))}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 4 }}>Condition you can see</div>
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder="Leave blank if unchanged"
                  options={CONDITION_OPTIONS}
                  onChange={(v) => setAdjust((a) => ({ ...a, actualCondition: v }))}
                />
              </div>
              <Input.TextArea
                rows={2}
                maxLength={500}
                placeholder="Remarks"
                onChange={(e) => setAdjust((a) => ({ ...a, remarks: e.target.value }))}
              />
            </Modal>
          </>
        )}
      </Spin>
    </div>
  );
};

export default AssetVerificationView;
