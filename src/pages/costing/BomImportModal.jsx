import { useState, useEffect } from 'react';
import { App, Modal, Table, Tag, Typography, Space, Empty, Spin, Alert } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { getBomsByStyleId } from '../../services/costing/costingService';

const { Text } = Typography;

const BomImportModal = ({ open, onClose, onApply, styleId }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [boms, setBoms] = useState([]);
  const [selectedBom, setSelectedBom] = useState(null);

  useEffect(() => {
    if (open && styleId) {
      setLoading(true);
      setSelectedBom(null);
      getBomsByStyleId(styleId)
        .then((data) => setBoms(data || []))
        .catch(() => message.error('Failed to load BOMs'))
        .finally(() => setLoading(false));
    }
  }, [open, styleId]);

  const handleApply = () => {
    if (!selectedBom) return;
    const fabricRows = [];
    const localTrims = [];
    const importedTrims = [];

    (selectedBom.lines || []).forEach((line) => {
      const catName = (line.categoryName || '').toLowerCase();
      // Carry the BOM line's variant identity so the imported costing row is variant-level
      // (per-size BOM lines have no single variantId — those import item-level, user picks a variant).
      const row = {
        key: `bom_${Date.now()}_${Math.random()}`,
        itemId: line.itemId,
        variantId: line.variantId || null,
        variantCode: line.variantCode || '',
        variantName: line.variantName || '',
        description: line.variantName || line.itemName || '',
        consumption: line.consumptionPerGarment || 0,
        uom: line.uom || '',
        sizes: '',
        comments: line.remarks || '',
      };

      if (catName.includes('fabric')) {
        fabricRows.push({
          ...row,
          fabricType: line.variantName || line.itemName || '',
          classification: 'Woven',
          fabricPrice: 0,
          allowancePct: 0,
          wastagePct: 0,
          netCost: 0,
        });
      } else if (catName.includes('import')) {
        importedTrims.push({ ...row, item: line.variantName || line.itemName, code: line.variantCode || line.itemCode || '', size: '', costUsd: 0, priceUsd: 0 });
      } else {
        localTrims.push({ ...row, item: line.variantName || line.itemName, code: line.variantCode || line.itemCode || '', size: '', cost: 0, price: 0 });
      }
    });

    onApply({ fabricRows, localTrims, importedTrims });
    onClose();
  };

  const columns = [
    { title: 'Item', dataIndex: 'itemName', ellipsis: true, render: (v, r) => r.variantName || v },
    { title: 'Category', dataIndex: 'categoryName', width: 120, render: (v) => <Tag>{v || '-'}</Tag> },
    { title: 'Consumption', dataIndex: 'consumptionPerGarment', width: 120, render: (v, r) => v ? `${Number(v).toFixed(4)} ${r.uom || ''}` : '-' },
    { title: 'Code', dataIndex: 'itemCode', width: 100, render: (v, r) => r.variantCode || v },
  ];

  return (
    <Modal
      title={<Space><ImportOutlined /> Import from BOM</Space>}
      open={open}
      onCancel={onClose}
      onOk={handleApply}
      okText="Import Selected BOM"
      okButtonProps={{ disabled: !selectedBom }}
      width={720}
      centered
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : boms.length === 0 ? (
        <Empty description="No approved BOMs found for this style" />
      ) : (
        <>
          <Alert type="info" showIcon message="Select a BOM below. Its fabric and trim lines will be imported into the costing form." style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {boms.map((bom) => (
              <Tag
                key={bom.id}
                color={selectedBom?.id === bom.id ? 'blue' : 'default'}
                style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                onClick={() => setSelectedBom(bom)}
              >
                {bom.orderNo || `BOM #${bom.id}`} — {bom.lineCount || 0} lines
              </Tag>
            ))}
          </div>
          {selectedBom && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Lines in {selectedBom.orderNo || `BOM #${selectedBom.id}`}
              </Text>
              <Table
                dataSource={selectedBom.lines || []}
                columns={columns}
                pagination={false}
                size="small"
                rowKey="id"
                scroll={{ y: 300 }}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default BomImportModal;
