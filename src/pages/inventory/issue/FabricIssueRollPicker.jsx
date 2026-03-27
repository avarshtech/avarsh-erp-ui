import { useMemo, useState } from 'react';
import { Table, Select, Alert, Typography } from 'antd';
import dayjs from 'dayjs';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const TOLERANCE_PCT = 5;

const FabricIssueRollPicker = ({ availableRolls = [], selectedRollIds = [], onSelectionChange, bomRequired = 0 }) => {
  const [shadeLotFilter, setShadeLotFilter] = useState(undefined);

  const shadeLotOptions = useMemo(() => {
    const lots = [...new Set(availableRolls.map((r) => r.shadeLot).filter(Boolean))];
    return lots.map((lot) => ({ label: lot, value: lot }));
  }, [availableRolls]);

  const filteredRolls = useMemo(() => {
    if (!shadeLotFilter) return availableRolls;
    return availableRolls.filter((r) => r.shadeLot === shadeLotFilter);
  }, [availableRolls, shadeLotFilter]);

  const selectedWeight = useMemo(
    () => availableRolls.filter((r) => selectedRollIds.includes(r.id)).reduce((sum, r) => sum + (r.weight || 0), 0),
    [availableRolls, selectedRollIds],
  );

  const overLimit = bomRequired > 0 && selectedWeight > bomRequired * (1 + TOLERANCE_PCT / 100);

  const columns = useMemo(() => [
    { title: 'Roll #', dataIndex: 'rollNumber', key: 'rollNumber', width: 110 },
    { title: 'Fabric', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 180, ellipsis: true },
    { title: 'Width (in)', dataIndex: 'width', key: 'width', width: 90, align: 'center' },
    { title: 'Weight (kg)', dataIndex: 'weight', key: 'weight', width: 100, align: 'right', render: (v) => formatNumber(v, 1) },
    { title: 'GSM', dataIndex: 'gsm', key: 'gsm', width: 70, align: 'center' },
    { title: 'Shade Lot', dataIndex: 'shadeLot', key: 'shadeLot', width: 100 },
    {
      title: 'Age (days)', key: 'age', width: 90, align: 'center',
      render: (_, r) => r.receivedDate ? dayjs().diff(dayjs(r.receivedDate), 'day') : '—',
    },
    { title: 'Style', dataIndex: 'style', key: 'style', width: 120 },
  ], []);

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedRollIds,
    onChange: (keys) => onSelectionChange(keys),
  }), [selectedRollIds, onSelectionChange]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Text>
          Select rolls to issue. <Text strong>BOM Required: {formatNumber(bomRequired, 1)} kg</Text> | <Text strong>Selected: {formatNumber(selectedWeight, 1)} kg</Text>
        </Text>
        <Select placeholder="Filter by shade lot" style={{ width: 180 }} allowClear options={shadeLotOptions} value={shadeLotFilter} onChange={setShadeLotFilter} />
      </div>

      {overLimit && (
        <Alert type="warning" showIcon message={`Selected weight (${formatNumber(selectedWeight, 1)} kg) exceeds BOM + ${TOLERANCE_PCT}% tolerance (${formatNumber(bomRequired * (1 + TOLERANCE_PCT / 100), 1)} kg)`} style={{ marginBottom: 12 }} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredRolls}
        rowSelection={rowSelection}
        pagination={false}
        scroll={{ x: 900 }}
        size="small"
      />
    </>
  );
};

export default FabricIssueRollPicker;
