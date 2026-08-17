import { useState, useEffect, useMemo } from 'react';
import { numericInputProps, integerInputProps } from '../../utils/inputHelpers';
import {
  Modal,
  Table,
  InputNumber,
  Input,
  Button,
  Space,
  Typography,
  Popconfirm,
  Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  DEFAULT_KNITS_PARTS,
  calcKnitsGramsPerPart,
  calcKnitsTotalGrams,
} from '../../utils/costingConstants';
import { convertGramsTo, isMassUom, massDecimalPlaces } from '../../utils/uomConversions';
import { useTheme } from '../../context/ThemeContext';

const { Text } = Typography;

/**
 * Knits fabric consumption calculator.
 *
 * The formula produces GRAMS. `targetUom` is the consumption UOM of the fabric row this
 * will be applied to, and the total is shown in that unit so what the user approves is
 * exactly what lands in the row. `onApply` still hands back the raw grams total — the
 * parent owns the conversion, since only it knows the row.
 */
const KnitsConsumptionModal = ({ open, onApply, onCancel, initialParts, targetUom }) => {
  const { isDarkMode } = useTheme();
  const [parts, setParts] = useState([]);

  // Initialize parts when modal opens
  useEffect(() => {
    if (open) {
      if (initialParts && initialParts.length > 0) {
        setParts(initialParts.map((p, i) => ({ ...p, key: `kp_${i}` })));
      } else {
        setParts(
          DEFAULT_KNITS_PARTS.map((p, i) => ({ ...p, key: `kp_${i}` }))
        );
      }
    }
  }, [open, initialParts]);

  const handleFieldChange = (key, field, value) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const updated = { ...p, [field]: value };
        // Auto-calc gramsPerPart unless user manually edited it
        if (field !== 'gramsPerPart') {
          const calc = calcKnitsGramsPerPart(
            updated.length,
            updated.width,
            updated.nop,
            updated.gsm
          );
          if (calc > 0) {
            updated.gramsPerPart = Math.round(calc * 100) / 100;
          }
        }
        return updated;
      })
    );
  };

  const handleAddPart = () => {
    setParts((prev) => [
      ...prev,
      {
        key: `kp_${Date.now()}`,
        partName: '',
        length: '',
        width: '',
        nop: 1,
        gsm: '',
        gramsPerPart: '',
      },
    ]);
  };

  const handleDeletePart = (key) => {
    setParts((prev) => prev.filter((p) => p.key !== key));
  };

  const totalGrams = useMemo(() => calcKnitsTotalGrams(parts), [parts]);

  // A blank targetUom (no fabric picked yet) falls back to grams, matching the row —
  // which shows no unit either until a variant is selected.
  const displayUom = targetUom || 'GMS';
  const nonMassUom = Boolean(targetUom) && !isMassUom(targetUom);
  const totalInTargetUom = convertGramsTo(totalGrams, targetUom) ?? 0;

  const handleApply = () => {
    onApply(totalGrams, parts);
  };

  const columns = [
    {
      title: 'S.No',
      width: 55,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Part Name',
      dataIndex: 'partName',
      width: 150,
      render: (val, record) => (
        <Input
          value={val}
          placeholder="e.g. Top, Sleeve"
          onChange={(e) => handleFieldChange(record.key, 'partName', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Length (cm)',
      dataIndex: 'length',
      width: 100,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          placeholder="L"
          onChange={(v) => handleFieldChange(record.key, 'length', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: 'Width (cm)',
      dataIndex: 'width',
      width: 100,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          placeholder="W"
          onChange={(v) => handleFieldChange(record.key, 'width', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: 'No. of Parts',
      dataIndex: 'nop',
      width: 95,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={1}
          placeholder="NOP"
          onChange={(v) => handleFieldChange(record.key, 'nop', v)}
          size="small"
          style={{ width: '100%' }}
          {...integerInputProps}
        />
      ),
    },
    {
      title: 'GSM',
      dataIndex: 'gsm',
      width: 90,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          placeholder="GSM"
          onChange={(v) => handleFieldChange(record.key, 'gsm', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: 'Grams/Part',
      dataIndex: 'gramsPerPart',
      width: 105,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          step={0.01}
          placeholder="Auto"
          onChange={(v) => handleFieldChange(record.key, 'gramsPerPart', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: '',
      width: 45,
      render: (_, record) => (
        <Popconfirm
          title="Remove this part?"
          onConfirm={() => handleDeletePart(record.key)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title="Knits Fabric Consumption Calculator"
      open={open}
      onCancel={onCancel}
      width={750}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      footer={
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" onClick={handleApply}>
            Apply
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Enter garment part dimensions to auto-calculate total fabric consumption in{' '}
          <Text strong style={{ fontSize: 13 }}>{displayUom.toUpperCase()}</Text> — the
          consumption unit of the selected fabric. You can also manually enter Grams per Part
          directly.
        </Text>
      </div>

      {nonMassUom && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`This fabric is consumed in ${targetUom.toUpperCase()}, which is not a unit of weight`}
          description={
            <Text style={{ fontSize: 12 }}>
              The knits formula calculates weight, so the total below is in grams and will be
              applied as-is. Set the item&apos;s secondary UOM to a weight unit (GMS / KG), or use
              the Woven calculator if this fabric is measured by length.
            </Text>
          }
        />
      )}

      <Table
        dataSource={parts}
        columns={columns}
        pagination={false}
        size="small"
        rowKey="key"
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row
              style={{
                background: isDarkMode
                  ? 'rgba(99, 102, 241, 0.08)'
                  : 'rgba(99, 102, 241, 0.05)',
              }}
            >
              <Table.Summary.Cell index={0} colSpan={6}>
                <Text strong style={{ fontSize: 14 }}>
                  TOTAL CONSUMPTION
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={2}>
                <Text
                  strong
                  style={{ fontSize: 15, color: 'var(--primary-color)' }}
                >
                  {totalInTargetUom.toFixed(massDecimalPlaces(targetUom))}{' '}
                  {displayUom.toUpperCase()}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddPart}
        style={{ width: '100%', marginTop: 12 }}
      >
        Add Part
      </Button>
    </Modal>
  );
};

export default KnitsConsumptionModal;
