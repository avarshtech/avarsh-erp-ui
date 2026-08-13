import { useMemo } from 'react';
import { Drawer, Table, Divider, Typography, Grid, Row, Col } from 'antd';
import { ActionButton } from '../../../components/buttons';
import { formatDate, formatNumber } from '../../../utils/formatters';
import { generateIssueSlipPdf } from '../../../utils/issueSlipPdfGenerator';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const InfoField = ({ label, value }) => (
  <div style={{ marginBottom: 16 }}>
    <Text
      type="secondary"
      style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}
    >
      {label}
    </Text>
    <Text strong style={{ fontSize: 14 }}>{value || '—'}</Text>
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ marginBottom: 16 }}>
    <Text strong style={{ fontSize: 15 }}>{children}</Text>
    <div style={{ height: 2, background: 'var(--border-color, #e5e7eb)', marginTop: 6, opacity: 0.6 }} />
  </div>
);

const fabricRollColumns = [
  { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', ellipsis: true, align: 'center' },
  { title: 'Issued Qty', dataIndex: 'issuedQty', key: 'issuedQty', align: 'center', render: (v) => formatNumber(v, 1) },
  { title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', ellipsis: true, align: 'center' },
];

const buildAccessoryItemColumns = () => [
  { title: 'Item Code', dataIndex: 'itemCode', key: 'itemCode', ellipsis: true, align: 'center', render: (v, r) => r.variantCode || v || '—' },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true, align: 'center' },
  { title: 'BOM Qty', dataIndex: 'bomQty', key: 'bomQty', align: 'center', render: (v) => formatNumber(v) },
  { title: 'Issue Qty', dataIndex: 'issuedQty', key: 'issuedQty', align: 'center', render: (v) => formatNumber(v) },
  {
    title: 'Excess / Shortage', key: 'delta', align: 'center',
    render: (_, record) => {
      const delta = (record.issuedQty || 0) - (record.bomQty || 0);
      if (delta === 0) return <Text type="secondary">—</Text>;
      const positive = delta > 0;
      const color = positive ? 'var(--success-color)' : 'var(--error-color)';
      const sign = positive ? '+' : '';
      return <Text style={{ color, fontWeight: 600 }}>{sign}{formatNumber(delta)}</Text>;
    },
  },
];

const IssueViewDrawer = ({ open, onClose, record, type }) => {
  const screens = useBreakpoint();
  const isFabric = type === 'fabric';
  // lg+ gets a roomier drawer so the Items table (Item Code + Description +
  // 3 qty columns) doesn't clip the rightmost header. Tablet stays at 820.
  const drawerWidth = screens.lg ? 900 : screens.md ? 820 : '100%';

  const accessoryItemColumns = useMemo(() => buildAccessoryItemColumns(), []);

  if (!record) return null;

  return (
    <Drawer
      title={record.issueNumber}
      open={open}
      onClose={onClose}
      width={drawerWidth}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ActionButton
            action="print"
            text="Print Issue Slip"
            onClick={() => generateIssueSlipPdf(record, isFabric ? 'fabric' : 'accessories')}
          />
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      <SectionTitle>Issue Information</SectionTitle>
      <Row gutter={[24, 0]}>
        <Col xs={24} sm={12}>
          <InfoField
            label={isFabric ? 'Cutting PO' : 'Work Order'}
            value={isFabric ? record.cuttingPO : record.workOrder}
          />
        </Col>
        {isFabric && (
          <Col xs={24} sm={12}>
            <InfoField label="PO Line" value={record.cuttingPOLine} />
          </Col>
        )}
        <Col xs={24} sm={12}>
          <InfoField label="Style" value={record.style} />
        </Col>
        {isFabric && (
          <Col xs={24} sm={12}>
            <InfoField label="Fabric" value={record.fabric} />
          </Col>
        )}
        <Col xs={24} sm={12}>
          <InfoField label="Production Unit" value={record.productionUnit} />
        </Col>
        <Col xs={24} sm={12}>
          <InfoField label="Issue Date" value={formatDate(record.issueDate)} />
        </Col>
        <Col xs={24} sm={12}>
          <InfoField label="Issued By" value={record.issuedBy} />
        </Col>
        <Col xs={24} sm={12}>
          <InfoField label="Received By" value={record.receivedBy} />
        </Col>
      </Row>

      <Divider style={{ margin: '8px 0 20px' }} />

      {isFabric && (
        <>
          <SectionTitle>BOM Summary</SectionTitle>
          <Row gutter={[24, 0]}>
            <Col xs={24} sm={12}>
              <InfoField label="BOM Required" value={`${formatNumber(record.bomRequired, 1)} ${record.uom || 'kg'}`} />
            </Col>
            <Col xs={24} sm={12}>
              <InfoField label="Total Issued" value={`${formatNumber(record.totalWeight, 1)} ${record.uom || 'kg'}`} />
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 20px' }} />

          <SectionTitle>Rolls ({record.rollsIssued || 0})</SectionTitle>
          {record.rolls && record.rolls.length > 0 ? (
            <Table rowKey="rollId" columns={fabricRollColumns} dataSource={record.rolls} pagination={false} size="small" />
          ) : (
            <Text type="secondary">Roll details not available in list view</Text>
          )}
        </>
      )}

      {!isFabric && (
        <>
          <SectionTitle>Issue Summary</SectionTitle>
          <Row gutter={[24, 0]}>
            <Col xs={24} sm={12}>
              <InfoField label="Total Items" value={record.itemsCount || 0} />
            </Col>
            <Col xs={24} sm={12}>
              <InfoField label="Total Qty" value={formatNumber(record.totalQty)} />
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 20px' }} />

          <SectionTitle>Items</SectionTitle>
          {record.items && record.items.length > 0 ? (
            <Table rowKey="itemCode" columns={accessoryItemColumns} dataSource={record.items} pagination={false} size="small" tableLayout="auto" />
          ) : (
            <Text type="secondary">Item details not available in list view</Text>
          )}
        </>
      )}

      {record.remarks && (
        <>
          <Divider />
          <Text type="secondary">Remarks: </Text>
          <Text>{record.remarks}</Text>
        </>
      )}
    </Drawer>
  );
};

export default IssueViewDrawer;
