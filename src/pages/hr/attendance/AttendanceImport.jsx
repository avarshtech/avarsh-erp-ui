import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, DatePicker, Button, Upload, Table, Tag,
  Statistic, Space, Alert, Radio, Typography, Steps,
} from 'antd';
import { UploadOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  downloadAttendanceTemplate, parseAttendanceFile, commitAttendanceImport,
  triggerBrowserDownload,
} from '../../../services/hr/attendanceService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import { factoryOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const statusMap = Object.fromEntries(ATTENDANCE_STATUS.map((s) => [s.value, s]));

const AttendanceImport = () => {
  const { message } = App.useApp();
  const canAdd = hasPermission('hr-attendance', 'add');

  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [period, setPeriod] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState('SKIP');

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  const contextReady = Boolean(factoryId && period?.[0] && period?.[1]);

  const params = useMemo(() => ({
    factoryId,
    periodFrom: period?.[0]?.format('YYYY-MM-DD'),
    periodTo: period?.[1]?.format('YYYY-MM-DD'),
  }), [factoryId, period]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadAttendanceTemplate(params);
      triggerBrowserDownload(blob, 'attendance-template.xlsx');
    } catch {
      message.error('Could not download the template');
    }
  }, [params, message]);

  const handleParse = useCallback(async () => {
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const parsed = await parseAttendanceFile({ file, ...params });
      setResult(parsed);
      if (parsed.errorRows > 0) {
        message.warning(`${parsed.errorRows} row(s) have errors and will not be imported`);
      } else {
        message.success(`${parsed.validRows} row(s) ready to import`);
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Could not read the file');
    } finally {
      setParsing(false);
    }
  }, [file, params, message]);

  const handleCommit = useCallback(async () => {
    if (!result?.rows?.length) return;
    setCommitting(true);
    try {
      const saved = await commitAttendanceImport(result.rows, duplicateStrategy === 'OVERWRITE');
      message.success(`Imported ${saved.length} attendance record(s)`);
      setResult(null);
      setFile(null);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Import failed. Nothing was saved.');
    } finally {
      setCommitting(false);
    }
  }, [result, duplicateStrategy, message]);

  const rowColumns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 110 },
    { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 180, ellipsis: true },
    {
      title: 'Date', dataIndex: 'attendanceDate', key: 'attendanceDate', width: 120,
      render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (v) => {
        const s = statusMap[v];
        return s ? <Tag color={s.tag}>{s.label}</Tag> : v;
      },
    },
    { title: 'Session', dataIndex: 'halfDaySession', key: 'halfDaySession', width: 120, render: (v) => v || '—' },
    { title: 'Leave Type', dataIndex: 'leaveTypeName', key: 'leaveTypeName', width: 140, render: (v) => v || '—' },
    { title: 'In', dataIndex: 'inTime', key: 'inTime', width: 80, render: (v) => v || '—' },
    { title: 'Out', dataIndex: 'outTime', key: 'outTime', width: 80, render: (v) => v || '—' },
    { title: 'OT', dataIndex: 'otHours', key: 'otHours', width: 70, align: 'right', render: (v) => v ?? 0 },
  ], []);

  const issueColumns = useMemo(() => [
    { title: 'Row', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 110 },
    { title: 'Column', dataIndex: 'field', key: 'field', width: 150 },
    {
      title: 'Severity', dataIndex: 'severity', key: 'severity', width: 100,
      render: (v) => <Tag color={v === 'ERROR' ? 'error' : 'warning'}>{v}</Tag>,
    },
    { title: 'Problem', dataIndex: 'message', key: 'message' },
  ], []);

  const currentStep = result ? 2 : file ? 1 : 0;

  return (
    <>
      <PageHeader title="Import Attendance" />

      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 16 }}
        items={[
          { title: 'Select period' },
          { title: 'Upload file' },
          { title: 'Review and import' },
        ]}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={8} md={6}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Factory</Text></div>
            <Select
              placeholder="Select factory"
              style={{ width: '100%' }}
              value={factoryId}
              onChange={setFactoryId}
              options={factoryOptions(factories)}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 4 }}><Text type="secondary">Period</Text></div>
            <RangePicker
              style={{ width: '100%' }}
              value={period}
              onChange={setPeriod}
              format="DD-MMM-YYYY"
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12} md={10}>
            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                disabled={!contextReady}
              >
                Download Template
              </Button>
              <Upload
                accept=".xlsx,.xls,.csv"
                maxCount={1}
                beforeUpload={(f) => { setFile(f); setResult(null); return false; }}
                onRemove={() => { setFile(null); setResult(null); }}
                fileList={file ? [file] : []}
              >
                <Button icon={<UploadOutlined />} disabled={!contextReady}>Select File</Button>
              </Upload>
              <Button
                type="primary"
                onClick={handleParse}
                loading={parsing}
                disabled={!file || !contextReady}
              >
                Validate
              </Button>
            </Space>
          </Col>
        </Row>

        {!contextReady && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="Choose a factory and period first. The template is generated for that factory's employees."
          />
        )}
      </Card>

      {result && (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}><Statistic title="Total Rows" value={result.totalRows} /></Col>
              <Col xs={12} sm={6}>
                <Statistic title="Ready to Import" value={result.validRows} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Warnings" value={result.warningRows} valueStyle={{ color: '#faad14' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Errors" value={result.errorRows} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
            </Row>
          </Card>

          {result.issues?.length > 0 && (
            <Card size="small" title="Issues" style={{ marginBottom: 16 }}>
              <Table
                rowKey={(r, i) => `${r.rowNumber}-${r.field}-${i}`}
                dataSource={result.issues}
                columns={issueColumns}
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                scroll={{ x: 700 }}
              />
            </Card>
          )}

          <Card
            size="small"
            title={`Rows to import (${result.validRows})`}
            extra={canAdd && (
              <Space>
                <Radio.Group
                  size="small"
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value)}
                  optionType="button"
                  options={[
                    { value: 'SKIP', label: 'Skip existing' },
                    { value: 'OVERWRITE', label: 'Overwrite existing' },
                  ]}
                />
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleCommit}
                  loading={committing}
                  disabled={!result.validRows}
                >
                  Import {result.validRows} Row(s)
                </Button>
              </Space>
            )}
          >
            <Table
              rowKey={(r, i) => `${r.employeeId}-${r.attendanceDate}-${i}`}
              dataSource={result.rows}
              columns={rowColumns}
              size="small"
              pagination={{ pageSize: 25, showSizeChanger: true }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </>
      )}
    </>
  );
};

export default AttendanceImport;
