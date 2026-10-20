import { memo } from 'react';
import { Col, Row, Select, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailCard from '../../../components/DetailCard';
import ReadOnlyField from '../jobWork/ReadOnlyField';
import PoField from '../jobWork/PoField';
import { FIELD_LABEL } from '../jobWork/poFieldStyles';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

/**
 * PO Header (PRD §11.1): number (shown once the first save gives it one), date (not future-dated, editable until
 * approval), branch (deviation D8; locked once lines exist — changing it clears the return
 * unit, which belongs to a branch), INR (D11), status; then order, buyer, style, garment and
 * fabric read-only from the requirement lines. In the Supplier PO view's look: label over value, inputs only while
 * the PO is being edited.
 */
const CppHeaderSection = memo(function CppHeaderSection({ doc, editable, branches, unit, onPatch }) {
  const lines = doc.lines;
  const unitId = doc.branchId ?? unit?.id ?? undefined;
  // An unsaved PO has no number: its column goes and the rest widen to keep the row full
  const numbered = Boolean(doc.poNo);
  const branchName = doc.branchName || branches?.find((b) => b.id === unitId)?.branchName || unit?.branchName;
  return (
    <DetailCard id="cpp-header" bare icon={<FileTextOutlined />} title="PO Header" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {numbered && <Col xs={12} md={5}><ReadOnlyField label="PO No." value={doc.poNo} locked={editable} /></Col>}
        <Col xs={12} md={numbered ? 4 : 5}>
          <PoField label="PO Date" editing={editable} htmlFor="cpp-poDate" text={formatDate(doc.poDate)}>
            <IsoDatePicker
              id="cpp-poDate" allowClear={false} value={doc.poDate}
              disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(poDate) => onPatch({ poDate })}
            />
          </PoField>
        </Col>
        <Col xs={12} md={numbered ? 4 : 6}>
          <PoField label="Branch" editing={editable && lines.length === 0} htmlFor="cpp-unit" text={branchName}>
            <Select
              id="cpp-unit" aria-label="Branch" style={{ width: '100%' }} value={unitId}
              options={(branches || []).map((b) => ({ value: b.id, label: b.branchName }))}
              placeholder={doc.branchName || 'Current branch'}
              onChange={(id) => onPatch({
                branchId: id, branchName: branches.find((b) => b.id === id)?.branchName ?? null,
                returnUnitId: null, returnUnitName: null, returnUnitAddress: null,
              })}
            />
          </PoField>
        </Col>
        <Col xs={12} md={numbered ? 3 : 4}><ReadOnlyField label="Currency" value="INR" locked={editable} /></Col>
        <Col xs={12} md={4}>
          <div style={FIELD_LABEL}>Status</div>
          <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />
          {doc.revisionNo > 0 && <Text type="secondary"> R{doc.revisionNo}</Text>}
        </Col>
        <Col xs={12} md={numbered ? 4 : 5}><ReadOnlyField label="Created by" value={doc.createdBy || '—'} locked={editable} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Order No." values={lines.map((l) => l.orderNo)} locked={editable} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Buyer" values={lines.map((l) => l.buyer)} locked={editable} /></Col>
        <Col xs={12} md={4}><ReadOnlyField label="Style" values={lines.map((l) => l.styleNo)} locked={editable} /></Col>
        <Col xs={12} md={6}><ReadOnlyField label="Garment" values={lines.map((l) => l.garment)} locked={editable} /></Col>
        <Col xs={12} md={6}><ReadOnlyField label="Fabric" values={lines.map((l) => l.fabricName)} locked={editable} /></Col>
      </Row>
    </DetailCard>
  );
});

export default CppHeaderSection;
