import { memo } from 'react';
import { Card, Col, Row, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import ReadOnlyField from '../jobWork/ReadOnlyField';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';

const { Text } = Typography;

/**
 * ① PO Header (PRD §11.1): number (on first save), date (not future-dated, editable until
 * approval), unit (a branch — deviation D8; locked once lines exist), INR (D11), status;
 * then order, buyer, style, garment and fabric read-only from the requirement lines.
 */
const CppHeaderSection = memo(function CppHeaderSection({ doc, editable, branches, unit, onPatch }) {
  const lines = doc.lines;
  const unitId = doc.branchId ?? unit?.id ?? undefined;
  return (
    <Card id="cpp-header" size="small" title="① PO Header" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={12} md={4}><ReadOnlyField label="PO No." value={doc.poNo || 'On first save'} /></Col>
        <Col xs={12} md={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>PO Date</Text>
          <IsoDatePicker
            id="cpp-poDate" allowClear={false} disabled={!editable} value={doc.poDate}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(poDate) => onPatch({ poDate })}
          />
        </Col>
        <Col xs={12} md={5}>
          <Text type="secondary" style={{ fontSize: 12 }}>Unit</Text>
          <Select
            id="cpp-unit" style={{ width: '100%' }} disabled={!editable || lines.length > 0} value={unitId}
            options={(branches || []).map((b) => ({ value: b.id, label: b.branchName }))}
            placeholder={doc.branchName || 'Current branch'}
            onChange={(id) => onPatch({ branchId: id, branchName: branches.find((b) => b.id === id)?.branchName ?? null })}
          />
        </Col>
        <Col xs={12} md={3}><ReadOnlyField label="Currency" value="INR" /></Col>
        <Col xs={12} md={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
          <div style={{ paddingTop: 4 }}>
            <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />
            {doc.revisionNo > 0 && <Text type="secondary"> R{doc.revisionNo}</Text>}
          </div>
        </Col>
        <Col xs={12} md={4}><ReadOnlyField label="Created by" value={doc.createdBy || '—'} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Order No." values={lines.map((l) => l.orderNo)} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Buyer" values={lines.map((l) => l.buyer)} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Style" values={lines.map((l) => l.styleNo)} /></Col>
        <Col xs={12} md={6}><ReadOnlyField label="Garment" values={lines.map((l) => l.garment)} /></Col>
        <Col xs={12} md={6}><ReadOnlyField label="Fabric" values={lines.map((l) => l.fabricName)} /></Col>
      </Row>
    </Card>
  );
});

export default CppHeaderSection;
