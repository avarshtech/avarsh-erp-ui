import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  App, Card, Row, Col, Select, DatePicker, Input, Button, Space, Empty, Spin,
  Descriptions, Modal, Typography,
} from 'antd';
import { SaveOutlined, CheckCircleFilled, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  listPOsWithPendingReturns,
  getPendingItems,
  createReturn,
} from '../../../services/inventory/returnToSupplierService';
import { generateReturnDcPdf } from '../../../utils/returnToSupplierPdfGenerator';
import { formatCurrency } from '../../../utils/formatters';
import { RETURN_TYPE, RETURN_TYPE_LABEL } from '../../../utils/returnToSupplierConstants';
import ReturnItemsTable from './ReturnItemsTable';

const { Text } = Typography;

const ReturnToSupplierForm = ({ returnType, onSaved }) => {
  const { message } = App.useApp();

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pos, setPos] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [returnDate, setReturnDate] = useState(dayjs());
  const [remarks, setRemarks] = useState('');

  // Reset state when toggle changes
  useEffect(() => {
    setSelectedPo(null);
    setPendingItems([]);
    setSelectedRowKeys([]);
    setReturnDate(dayjs());
    setRemarks('');
    let cancelled = false;
    (async () => {
      setLoadingPOs(true);
      try {
        const data = await listPOsWithPendingReturns(returnType);
        if (!cancelled) setPos(data);
      } catch (e) {
        if (!cancelled) message.error(e?.response?.data?.message || 'Failed to load POs');
      } finally {
        if (!cancelled) setLoadingPOs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [returnType, message]);

  const loadPendingItems = useCallback(async (poId) => {
    setLoadingItems(true);
    setPendingItems([]);
    setSelectedRowKeys([]);
    try {
      const data = await getPendingItems(poId, returnType);
      setPendingItems(data);
      // Pre-select all rows — user deselects to exclude (matches CRD default)
      const allKeys = data.map((row) => rowKey(row, returnType));
      setSelectedRowKeys(allKeys);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to load rejected items');
    } finally {
      setLoadingItems(false);
    }
  }, [returnType, message]);

  const handlePoChange = (poId) => {
    const po = pos.find((p) => p.poId === poId) || null;
    setSelectedPo(po);
    if (po) loadPendingItems(po.poId);
  };

  const poOptions = useMemo(
    () => pos.map((p) => ({
      value: p.poId,
      label: `${p.poNumber} — ${p.supplierName} (${p.pendingItemCount} pending)`,
    })),
    [pos]
  );

  const handleSave = async () => {
    if (!selectedPo) { message.warning('Select a PO first'); return; }
    if (selectedRowKeys.length === 0) { message.warning('Select at least one item to return'); return; }

    const items = selectedRowKeys.map((key) => {
      const row = pendingItems.find((r) => rowKey(r, returnType) === key);
      return returnType === RETURN_TYPE.FABRIC
        ? { qcRollId: row.qcRollId }
        : { qcCriteriaId: row.qcCriteriaId };
    });

    setSaving(true);
    try {
      const result = await createReturn({
        returnType,
        poId: selectedPo.poId,
        returnDate: returnDate.format('YYYY-MM-DD'),
        remarks,
        items,
      });

      Modal.confirm({
        title: 'Return Saved Successfully',
        icon: <CheckCircleFilled style={{ color: 'var(--color-success, #52c41a)' }} />,
        content: (
          <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
            <div><Text type="secondary">Return DC: </Text><Text strong>{result.returnNumber}</Text></div>
            <div><Text type="secondary">Debit Note: </Text><Text strong>{result.debitNote?.debitNoteNumber || '—'}</Text></div>
            <div><Text type="secondary">Grand Total: </Text><Text strong>{formatCurrency(result.grandTotal)}</Text></div>
          </Space>
        ),
        okText: 'Print Return DC',
        okButtonProps: { icon: <PrinterOutlined /> },
        cancelText: 'Close',
        onOk: () => generateReturnDcPdf(result).catch(() => message.error('Failed to print Return DC')),
      });

      // Reset form + bubble up for history refresh
      setSelectedPo(null);
      setPendingItems([]);
      setSelectedRowKeys([]);
      setRemarks('');
      onSaved?.();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save return');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>PO Number *</div>
            <Select
              showSearch
              placeholder={`Select ${RETURN_TYPE_LABEL[returnType]} PO with pending returns`}
              value={selectedPo?.poId}
              onChange={handlePoChange}
              options={poOptions}
              loading={loadingPOs}
              optionFilterProp="label"
              style={{ width: '100%' }}
              notFoundContent={
                loadingPOs ? <Spin size="small" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No POs with pending returns" />
              }
            />
          </Col>
          <Col xs={24} md={6}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Return DC Date *</div>
            <DatePicker
              value={returnDate}
              onChange={(d) => setReturnDate(d || dayjs())}
              format="DD-MMM-YYYY"
              allowClear={false}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={10}>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Remarks</div>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
          </Col>
        </Row>

        {selectedPo && (
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }} style={{ marginTop: 16 }} bordered>
            <Descriptions.Item label="Supplier">{selectedPo.supplierName}</Descriptions.Item>
            <Descriptions.Item label="PO Date">{selectedPo.poDate ? dayjs(selectedPo.poDate).format('DD-MMM-YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="GRN Ref" span={2}>{selectedPo.grnRef || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        size="small"
        title={`Rejected ${RETURN_TYPE_LABEL[returnType]} Items`}
        extra={
          <Space>
            <Text type="secondary">{selectedRowKeys.length} of {pendingItems.length} selected</Text>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <ReturnItemsTable
          returnType={returnType}
          rows={pendingItems}
          loading={loadingItems}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
        />
      </Card>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <PermissionGuard module="inventory-return-supplier" operation="add">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!selectedPo || selectedRowKeys.length === 0}
            onClick={handleSave}
          >
            Save &amp; Generate Return DC
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
};

const rowKey = (row, type) =>
  type === RETURN_TYPE.FABRIC ? `roll-${row.qcRollId}` : `crit-${row.qcCriteriaId}`;

export default ReturnToSupplierForm;
