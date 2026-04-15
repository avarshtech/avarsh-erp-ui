import { useState, useEffect, useMemo } from 'react';
import { Modal, Row, Col, Card, Table, Tag, Typography, Avatar, Divider, Alert, Space, Skeleton } from 'antd';
import useResponsive from '../../../hooks/useResponsive';
import {
  ExperimentOutlined,
  CalendarOutlined,
  UserOutlined,
  NumberOutlined,
  BugOutlined,
  CheckSquareOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { QC_STATUS_CONFIG } from '../../../utils/statusConfig';
import { QC_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber, formatDate } from '../../../utils/formatters';
import { generateFabricQCPdf } from '../../../utils/fabricQCPdfGenerator';
import { generateTrimsQCPdf } from '../../../utils/trimsQCPdfGenerator';
import QCApprovalActions from './QCApprovalActions';

const { Text, Title } = Typography;

// Hero accent map — matches GRN/QC_STATUS_CONFIG palette so each state is distinct
const HERO_ACCENT = {
  [QC_STATUS.DRAFT]:                  '#8c8c8c',   // default / gray
  [QC_STATUS.SUBMITTED]:              'var(--primary-color)', // processing blue
  [QC_STATUS.PENDING_APPROVAL]:       '#2f54eb',   // geekblue
  [QC_STATUS.APPROVED]:               'var(--success-color)', // green
  [QC_STATUS.CONDITIONAL_PASS]:       '#13c2c2',   // cyan — approved with qualifications
  [QC_STATUS.REJECTED]:               'var(--error-color)',   // red
  [QC_STATUS.REJECTED_WITH_BACKUP]:   '#d4380d',   // volcano — rejected but kept as back-up
  [QC_STATUS.REFERRED_BACK_PENDING]:  '#faad14',   // gold
  [QC_STATUS.REFERRED_BACK]:          '#722ed1',   // purple
};

// Statuses that hide the Print Report button — the QC is either still being
// drafted, has been invalidated (rejected / rejected-with-backup) or has been
// pulled back for re-inspection (referred back). Applies to both Fabric and
// Accessories QC.
const PDF_HIDDEN_STATUSES = new Set([
  QC_STATUS.DRAFT,
  QC_STATUS.REJECTED,
  QC_STATUS.REJECTED_WITH_BACKUP,
  QC_STATUS.REFERRED_BACK,
]);

const labelStyle = { fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 };

const fabricRollColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', align: 'center', width: 90 },
  { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 140, render: (v) => <Text code style={{ fontSize: 12 }}>{v || '—'}</Text> },
  { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true },
  { title: 'Width', dataIndex: 'stdWidth', align: 'center', width: 100 },
  { title: 'GSM', dataIndex: 'stdGsm', align: 'center', width: 100 },
  { title: 'Actual Width', dataIndex: 'actualWidth', align: 'center', width: 110 },
  { title: 'Actual GSM', dataIndex: 'actualGsm', align: 'center', width: 110 },
];

const fabricDefectColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', align: 'center', width: 100 },
  { title: 'Defect Type', dataIndex: 'defectTypeName', align: 'center', width: 160 },
  { title: 'Defects', dataIndex: 'count', align: 'center', width: 100, render: (v) => formatNumber(v) },
  { title: 'Remarks', dataIndex: 'remarks', align: 'center', ellipsis: true },
];

const trimsCriteriaColumns = [
  { title: 'Criteria', dataIndex: 'criteria', align: 'center', width: 200 },
  {
    title: 'Result',
    key: 'result',
    align: 'center',
    width: 120,
    render: (_, r) => r.ok ? <Tag color="green">OK</Tag> : r.notOk ? <Tag color="red">Not OK</Tag> : <Tag>—</Tag>,
  },
  { title: 'Remarks', dataIndex: 'remarks', align: 'center', ellipsis: true },
];

const QCViewModal = ({ open, onClose, record: initialRecord, type = 'fabric' }) => {
  const [qc, setQc] = useState(initialRecord);
  const { isMobile, isTablet } = useResponsive();
  const modalWidth = isMobile ? '100vw' : isTablet ? '94vw' : 1200;

  useEffect(() => { setQc(initialRecord); }, [initialRecord]);

  const isFabric = type === 'fabric';
  const accent = HERO_ACCENT[qc?.status] || 'var(--primary-color)';

  const summary = useMemo(() => {
    if (!qc) return { rolls: 0, passed: 0, failed: 0, defects: 0, criteria: 0, ok: 0, notOk: 0 };
    if (isFabric) {
      const rolls = qc.rolls || [];
      const defects = qc.defects || [];
      const defectsByRoll = new Map();
      defects.forEach((d) => {
        const arr = defectsByRoll.get(d.rollNumber) || [];
        arr.push(d);
        defectsByRoll.set(d.rollNumber, arr);
      });
      let passed = 0;
      let failed = 0;
      rolls.forEach((r) => {
        const widthOk = r.stdWidth && r.actualWidth != null && Math.abs(r.actualWidth - r.stdWidth) <= r.stdWidth * 0.05;
        const gsmOk = r.stdGsm && r.actualGsm != null && Math.abs(r.actualGsm - r.stdGsm) <= r.stdGsm * 0.05;
        const dc = (defectsByRoll.get(r.rollNumber) || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
        if (r.actualWidth == null || r.actualGsm == null) return;
        if (widthOk && gsmOk && dc <= 3) passed += 1;
        else failed += 1;
      });
      return { rolls: rolls.length, passed, failed, defects: defects.length, criteria: 0, ok: 0, notOk: 0 };
    }
    const criteria = qc.criteriaRows || qc.criteriaChecks || [];
    return {
      rolls: 0,
      passed: 0,
      failed: 0,
      defects: 0,
      criteria: criteria.length,
      ok: criteria.filter((c) => c.ok).length,
      notOk: criteria.filter((c) => c.notOk).length,
    };
  }, [qc, isFabric]);

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width={modalWidth}
      centered
      closable
      className="po-view-modal"
      styles={{
        body: { maxHeight: 'calc(85vh - 60px)', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: { border: 'none', padding: 0, margin: 0, minHeight: 0 },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
          <Space size="middle">
            {qc && !PDF_HIDDEN_STATUSES.has(qc.status) && (
              <ActionButton
                action="print"
                text="Print Report"
                onClick={() => (isFabric ? generateFabricQCPdf(qc) : generateTrimsQCPdf(qc))}
              />
            )}
            <QCApprovalActions qc={qc} type={type} onUpdated={(updated) => setQc(updated)} />
          </Space>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      {!qc ? (
        <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
          <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
          <Divider />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <>
          {/* ===== HERO HEADER ===== */}
          <div
            style={{
              background: 'var(--card-bg, #fff)',
              borderBottom: '2px solid var(--border-color, #f0f0f0)',
              padding: '28px 32px 20px',
              borderLeft: `4px solid ${accent}`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Title level={3} style={{ margin: 0, letterSpacing: '-0.02em' }}>{qc.qcNumber || '—'}</Title>
                  <StatusTag status={qc.status} config={QC_STATUS_CONFIG} getLabel={getInventoryStatusLabel} style={{ fontSize: 13, padding: '3px 14px' }} />
                  <Tag color={isFabric ? 'blue' : 'purple'} style={{ borderRadius: 20, fontSize: 12 }}>{isFabric ? 'Fabric' : 'Accessories'} QC</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ExperimentOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                    <Text strong style={{ fontSize: 15 }}>{qc.grnNumber || '—'}</Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                    <Text type="secondary">{formatDate(qc.inspectionDate)}</Text>
                  </div>
                  {qc.inspector && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserOutlined style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                      <Text type="secondary">Inspected by {qc.inspector}</Text>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {isFabric ? (
                  <>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Rolls (P / F)</Text>
                    <Text strong style={{ fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      <span style={{ color: 'var(--success-color)' }}>{summary.passed}</span>
                      <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>/</span>
                      <span style={{ color: summary.failed > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>{summary.failed}</span>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Criteria (OK / Not OK)</Text>
                    <Text strong style={{ fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      <span style={{ color: 'var(--success-color)' }}>{summary.ok}</span>
                      <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>/</span>
                      <span style={{ color: summary.notOk > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>{summary.notOk}</span>
                    </Text>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ===== BODY ===== */}
          <div style={{ padding: '20px 32px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={24} md={16}>
                <Card size="small" style={{ height: '100%', borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
                  <Row gutter={[24, 14]}>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>QC Number</Text>
                      <Text strong style={{ fontSize: 14, fontFamily: 'monospace' }}>{qc.qcNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>GRN Number</Text>
                      <Text strong style={{ fontSize: 14, fontFamily: 'monospace' }}>{qc.grnNumber || '—'}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Inspection Date</Text>
                      <Text strong style={{ fontSize: 14 }}>{formatDate(qc.inspectionDate)}</Text>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Inspector</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar size={24} style={{ backgroundColor: 'var(--primary-color)', fontSize: 11, flexShrink: 0 }}>{(qc.inspector || '?')[0]}</Avatar>
                        <Text strong style={{ fontSize: 14 }}>{qc.inspector || '—'}</Text>
                      </div>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Text type="secondary" style={labelStyle}>Type</Text>
                      <Tag color={isFabric ? 'blue' : 'purple'}>{isFabric ? 'Fabric' : 'Accessories'}</Tag>
                    </Col>
                    {!isFabric && (
                      <>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={labelStyle}>Qty Ordered</Text>
                          <Text strong style={{ fontSize: 14 }}>{formatNumber(qc.qtyOrdered || 0)}</Text>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={labelStyle}>Qty Received (cumulative)</Text>
                          <Text strong style={{ fontSize: 14 }}>{formatNumber(qc.qtyReceived || 0)}</Text>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={labelStyle}>Qty Checked (this GRN)</Text>
                          <Text strong style={{ fontSize: 14 }}>{formatNumber(qc.qtyChecked || 0)}</Text>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Text type="secondary" style={labelStyle}>Qty Verdict</Text>
                          {qc.qtyVerdict === 'MATCHED'
                            ? <Tag color="success">Matched</Tag>
                            : qc.qtyVerdict === 'SHORT'
                            ? <Tag color="error">Short</Tag>
                            : <Tag>—</Tag>}
                        </Col>
                      </>
                    )}
                  </Row>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card
                  size="small"
                  style={{ height: '100%', borderRadius: 12 }}
                  styles={{ body: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 } }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Inspection Summary
                  </Text>

                  {/* Headline status — neutral tinted surface, no primary fill */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--bg-tertiary, rgba(99, 102, 241, 0.08))',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Status
                      </Text>
                      <Text strong style={{ fontSize: 16, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                        {getInventoryStatusLabel(qc.status)}
                      </Text>
                    </div>
                  </div>

                  {/* Breakdown rows — icon + label + value, neutral styling */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {isFabric ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <AppstoreOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Rolls Inspected</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14 }}>{summary.rolls}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <CheckCircleOutlined style={{ color: 'var(--success-color)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Passed</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14, color: 'var(--success-color)' }}>{summary.passed}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <CloseCircleOutlined style={{ color: summary.failed > 0 ? 'var(--error-color)' : 'var(--text-secondary)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Failed</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14, color: summary.failed > 0 ? 'var(--error-color)' : undefined }}>{summary.failed}</Text>
                        </div>
                        <Divider style={{ margin: '2px 0' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <BugOutlined style={{ color: 'var(--warning-color)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Defects Logged</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14, color: summary.defects > 0 ? 'var(--warning-color)' : undefined }}>{summary.defects}</Text>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <AppstoreOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Criteria Checked</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14 }}>{summary.criteria}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <CheckCircleOutlined style={{ color: 'var(--success-color)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>OK</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14, color: 'var(--success-color)' }}>{summary.ok}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space size={8}>
                            <CloseCircleOutlined style={{ color: summary.notOk > 0 ? 'var(--error-color)' : 'var(--text-secondary)', fontSize: 14 }} />
                            <Text type="secondary" style={{ fontSize: 13 }}>Not OK</Text>
                          </Space>
                          <Text strong style={{ fontSize: 14, color: summary.notOk > 0 ? 'var(--error-color)' : undefined }}>{summary.notOk}</Text>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </Col>
            </Row>

            {(qc.referBackReason || qc.rejectionReason) && (
              <div style={{ marginBottom: 20 }}>
                {qc.referBackReason && <Alert type="warning" showIcon style={{ borderRadius: 10, marginBottom: 8 }} message="Refer-back reason" description={qc.referBackReason} />}
                {qc.rejectionReason && <Alert type="error" showIcon style={{ borderRadius: 10 }} message="Rejection reason" description={qc.rejectionReason} />}
              </div>
            )}

            {isFabric && qc.rolls?.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <NumberOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Pre-Roll Inspection</Text>
                  </Space>
                }
              >
                <Table rowKey={(r, i) => `${r.rollNumber}-${i}`} columns={fabricRollColumns} dataSource={qc.rolls} pagination={false} size="small" scroll={{ x: 840 }} />
              </Card>
            )}

            {isFabric && qc.defects?.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <BugOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Defect Analysis</Text>
                  </Space>
                }
              >
                <Table rowKey={(r, i) => `${r.rollNumber}-${i}`} columns={fabricDefectColumns} dataSource={qc.defects} pagination={false} size="small" scroll={{ x: 600 }} />
              </Card>
            )}

            {!isFabric && (qc.criteriaRows || qc.criteriaChecks)?.length > 0 && (
              <Card
                size="small"
                style={{ marginBottom: 20, borderRadius: 12 }}
                styles={{ body: { padding: '14px 20px' } }}
                title={
                  <Space>
                    <CheckSquareOutlined style={{ color: 'var(--primary-color)' }} />
                    <Text strong style={{ fontSize: 14 }}>Criteria Checks</Text>
                  </Space>
                }
              >
                <Table rowKey="id" columns={trimsCriteriaColumns} dataSource={qc.criteriaRows || qc.criteriaChecks} pagination={false} size="small" />
              </Card>
            )}

          </div>
        </>
      )}
    </Modal>
  );
};

export default QCViewModal;
