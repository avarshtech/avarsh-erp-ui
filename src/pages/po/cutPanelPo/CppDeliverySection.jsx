import { memo } from 'react';
import { Card, Col, Input, Row, Select, Table, Typography } from 'antd';
import JobWorkReferences from '../jobWork/JobWorkReferences';
import JobWorkValueSummary from '../jobWork/JobWorkValueSummary';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import { CPP_RETURN_TO, FREIGHT_OPTIONS, PROCESSING_LOCATIONS } from '../../../utils/jobWorkConstants';
import { balanceBlock } from '../../../utils/cutPanelPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12 }}>{children}</Text>;
const BALANCE_COLUMNS = [
  { title: 'CPR', dataIndex: 'cprNo' },
  { title: 'Required', dataIndex: 'required', align: 'right', render: n },
  { title: "Previously PO'd", dataIndex: 'prevPoQty', align: 'right', render: n },
  { title: 'This PO', dataIndex: 'thisPo', align: 'right', render: n },
  { title: 'Balance after', dataIndex: 'balanceAfter', align: 'right', render: (v) => <strong>{n(v)}</strong> },
];

/**
 * ⑤ Delivery, Instructions & Value (PRD FR-21/22, §13.3, §15.4): processing location,
 * panel issue date, Return To and return unit, freight; instructions (from the process,
 * editable in any status) and reference links; the value block and the live balance block
 * (per requirement, from `ctx`).
 * `can` = { delivery, terms, notes, commercial } — the panel issue date is a term an amendment may change.
 */
const CppDeliverySection = memo(function CppDeliverySection({ doc, ctx, value, can, branches, onPatch, onCommercial }) {
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  return (
    <Card id="cpp-delivery" size="small" title="⑤ Delivery, Instructions & Value" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={12} md={6}><Label>Processing location</Label>
          <Select id="cpp-processingLocation" style={{ width: '100%' }} disabled={!can.delivery} options={PROCESSING_LOCATIONS} value={doc.processingLocation} onChange={(v) => onPatch({ processingLocation: v })} /></Col>
        <Col xs={12} md={6}><Label>Vendor location</Label>
          <Input id="cpp-vendorLocation" disabled={!can.delivery} value={doc.vendorLocation} onChange={(e) => onPatch({ vendorLocation: e.target.value })} /></Col>
        <Col xs={12} md={6}><Label>Panel issue date</Label>
          <IsoDatePicker id="cpp-panelIssueDate" disabled={!can.terms} value={doc.panelIssueDate} onChange={(panelIssueDate) => onPatch({ panelIssueDate })} /></Col>
        <Col xs={12} md={6}><Label>Freight</Label>
          <Select id="cpp-freight" style={{ width: '100%' }} disabled={!can.delivery} options={FREIGHT_OPTIONS} value={doc.freight} onChange={(v) => onPatch({ freight: v })} /></Col>
        <Col xs={12} md={6}><Label>Return to</Label>
          <Select id="cpp-returnTo" style={{ width: '100%' }} disabled={!can.delivery} options={CPP_RETURN_TO} value={doc.returnTo} onChange={(v) => onPatch({ returnTo: v })} /></Col>
        {doc.returnTo === 'OTHER' && (
          <Col xs={12} md={6}><Label>Return to (other)</Label>
            <Input id="cpp-returnToOther" disabled={!can.delivery} value={doc.returnToOther} onChange={(e) => onPatch({ returnToOther: e.target.value })} /></Col>
        )}
        <Col xs={12} md={6}><Label>Return unit</Label>
          <Select id="cpp-returnUnit" style={{ width: '100%' }} disabled={!can.delivery} value={doc.returnBranchId ?? undefined} placeholder={doc.returnBranchName || 'Current unit'}
            options={(branches || []).map((b) => ({ value: b.id, label: b.branchName }))}
            onChange={(id) => onPatch({ returnBranchId: id, returnBranchName: branches.find((b) => b.id === id)?.branchName ?? null })} /></Col>
        <Col xs={24}><Label>Processing instructions</Label>
          <Input.TextArea id="cpp-instructions" rows={2} maxLength={2000} disabled={!can.notes} value={doc.instructions} onChange={(e) => onPatch({ instructions: e.target.value })} /></Col>
        <Col xs={24}><Label>Reference documents</Label>
          <JobWorkReferences references={doc.references} editable={can.delivery} required={doc.process?.artworkRequired} onChange={(references) => onPatch({ references })} /></Col>
        <Col xs={24}><Label>Remarks (internal — never printed)</Label>
          <Input.TextArea id="cpp-remarks" rows={2} maxLength={1000} disabled={!can.notes} value={doc.remarks} onChange={(e) => onPatch({ remarks: e.target.value })} /></Col>
        <Col xs={24} lg={12}>
          <Text strong>PO value</Text>
          <JobWorkValueSummary value={value} qty={qty} sacCode={doc.process?.sacCode} commercial={doc} editable={can.commercial} onChange={onCommercial} />
        </Col>
        <Col xs={24} lg={12}>
          <Text strong>Balance</Text>
          <Table size="small" rowKey="cprNo" pagination={false} dataSource={balanceBlock(doc, ctx)} columns={BALANCE_COLUMNS} style={{ marginTop: 4 }} />
        </Col>
      </Row>
    </Card>
  );
});

export default CppDeliverySection;
