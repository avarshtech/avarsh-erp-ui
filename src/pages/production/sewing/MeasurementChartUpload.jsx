import { useCallback, useMemo, useState } from 'react';
import { App, Modal, Upload, Button, Table, Alert, Space, Tag } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { parseMeasurementChart, saveMeasurementChart } from '../../../services/production/sewingService';

/**
 * Uploads the buyer's measurement chart for a style. The file is read on the
 * server and shown back before anything is committed, so a sheet laid out the
 * wrong way round is caught on screen instead of becoming the spec every
 * garment is measured against.
 */
const MeasurementChartUpload = ({ open, styleNo, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => { setParsed(null); onClose(); }, [onClose]);

  const handleFile = useCallback(async (file) => {
    setParsing(true);
    try {
      setParsed(await parseMeasurementChart(file, styleNo));
    } catch (e) {
      message.error(e?.response?.data?.message || 'The chart could not be read');
      setParsed(null);
    } finally { setParsing(false); }
    return false; // parsed through our own endpoint, never auto-uploaded
  }, [styleNo, message]);

  /** One row per point, one column per size — the sheet as the buyer wrote it. */
  const { rows, columns } = useMemo(() => {
    if (!parsed) return { rows: [], columns: [] };
    const byPoint = new Map();
    parsed.specs.forEach((s) => {
      const row = byPoint.get(s.point) || { point: s.point, tolerance: s.tolerance };
      row[s.size] = s.spec;
      byPoint.set(s.point, row);
    });
    return {
      rows: [...byPoint.values()],
      columns: [
        { title: 'Measurement Point', dataIndex: 'point', width: 200, fixed: 'left' },
        { title: 'Tol ±', dataIndex: 'tolerance', width: 80, align: 'center' },
        ...parsed.sizes.map((size) => ({ title: size, dataIndex: size, width: 90, align: 'right' })),
      ],
    };
  }, [parsed]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveMeasurementChart({
        styleNo,
        sourceFileName: parsed.fileName,
        specs: parsed.specs,
      });
      message.success(`Chart saved — ${saved.length} spec points for ${styleNo}`);
      setParsed(null);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the chart');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      title={`Measurement Chart — ${styleNo || 'select a style first'}`}
      open={open}
      onCancel={close}
      width={900}
      destroyOnHidden
      footer={(
        <Space>
          <Button onClick={close}>Cancel</Button>
          <Button type="primary" disabled={!parsed} loading={saving} onClick={handleSave}>
            Replace chart for {styleNo}
          </Button>
        </Space>
      )}
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Expected sheet layout"
        description="Column 1: measurement point. Column 2: tolerance. Then one column per size, with the size name in the header row." />

      <Upload.Dragger accept=".xlsx,.xls" maxCount={1} beforeUpload={handleFile}
        showUploadList={false} disabled={parsing || !styleNo}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{parsing ? 'Reading the chart…' : 'Click or drag the buyer chart here'}</p>
        <p className="ant-upload-hint">Excel (.xlsx / .xls). Nothing is saved until you confirm below.</p>
      </Upload.Dragger>

      {parsed && (
        <>
          <Space style={{ margin: '14px 0 8px' }} wrap>
            <strong>{parsed.fileName}</strong>
            <Tag color="blue">{rows.length} points</Tag>
            <Tag color="blue">{parsed.sizes.length} sizes</Tag>
            <span style={{ color: 'var(--text-secondary)' }}>
              This replaces the whole chart for {styleNo}. Reports already saved keep the spec they were measured against.
            </span>
          </Space>
          {parsed.warnings?.length > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              title={`${parsed.warnings.length} row(s) were skipped`}
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
          )}
          <Table rowKey="point" size="small" columns={columns} dataSource={rows}
            pagination={false} scroll={{ x: 'max-content', y: 320 }} />
        </>
      )}
    </Modal>
  );
};

export default MeasurementChartUpload;
