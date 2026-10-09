import { useEffect, useMemo, useState } from 'react';
import {
  Card, InputNumber, Space, Table, Tag, Typography,
} from 'antd';
import { integerInputProps } from '../../../../utils/inputHelpers';
import { formatRanges } from '../../../../utils/expDocCalc';
import { cartonPrintHistory } from '../../../../services/expdoc/expDocService';
import { runValuesText } from './stickerWorkspaceModel';

const { Text } = Typography;
const none = <Text type="secondary">—</Text>;

const COLUMNS = [
  { title: 'Run', dataIndex: 'runNo', key: 'runNo' },
  { title: 'Cartons', key: 'cartons', render: (_, r) => formatRanges(r.prints || []) },
  { title: 'Layout', key: 'layout', render: (_, r) => `${r.templateCode} v${r.templateVersion}` },
  { title: 'Values', key: 'values', render: (_, r) => runValuesText(r) || none },
  { title: 'Labels', dataIndex: 'labelCount', key: 'labels', align: 'right' },
  {
    title: 'Kind',
    key: 'kind',
    render: (_, r) => (
      <Space size={4}>
        {r.isReprint && <Tag color="purple">Reprint</Tag>}
        {r.fromDraft && <Tag color="gold">From draft</Tag>}
        {!r.isReprint && !r.fromDraft && <Text type="secondary">Original</Text>}
      </Space>
    ),
  },
  { title: 'Generated', key: 'generated', render: (_, r) => `${r.generatedAt} · ${r.generatedBy}` },
  { title: 'Reason', key: 'reason', render: (_, r) => r.reprintReason || r.overrideReason || none },
];

/**
 * Every run printed for this packing list, latest first, with the values each was asked
 * for — and when one carton was printed, by which runs.
 */
const StickerRunHistory = ({ plId, runs }) => {
  const rows = useMemo(() => [...(runs || [])].sort((a, b) => b.id - a.id), [runs]);
  const [cartonNo, setCartonNo] = useState(null);
  const [found, setFound] = useState({ cartonNo: null, history: null });
  // Looked up again when a run is printed, so the answer never lags the table above it;
  // only the carton typed last may land.
  useEffect(() => {
    if (!cartonNo) return undefined;
    let latest = true;
    cartonPrintHistory(plId, cartonNo)
      .then((history) => { if (latest) setFound({ cartonNo, history }); })
      .catch(() => { if (latest) setFound({ cartonNo, history: null, failed: true }); });
    return () => { latest = false; };
  }, [plId, runs, cartonNo]);
  const { history, failed } = found.cartonNo === cartonNo ? found : {};

  return (
    <Card title="Printed runs" size="small" style={{ marginTop: 16 }}>
      <Table
        rowKey="id"
        size="small"
        className="table-nowrap"
        scroll={{ x: 'max-content' }}
        columns={COLUMNS}
        dataSource={rows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: 'Nothing printed yet for this packing list.' }}
      />
      <Space wrap style={{ marginTop: 12 }}>
        <Text strong>Carton print history</Text>
        <InputNumber
          {...integerInputProps} min={1} name="sticker-carton-history" aria-label="Carton no"
          placeholder="Carton no" onChange={setCartonNo}
        />
        {history && (
          <Text type="secondary">
            {history.timesPrinted
              ? `printed ${history.timesPrinted}×: ${history.events.map((e) => `${e.runNo} (${e.at})`).join(', ')}`
              : 'never printed'}
          </Text>
        )}
        {failed && <Text type="danger">Its print history could not be read.</Text>}
      </Space>
    </Card>
  );
};

export default StickerRunHistory;
