import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Row, Col, Select, DatePicker, Button, Upload, Table, Tag,
  Statistic, Space, Alert, Radio, Typography, Steps,
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, CheckCircleOutlined, PaperClipOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  downloadAttendanceTemplate, parseAttendanceFile, commitAttendanceImport,
  triggerBrowserDownload,
} from '../../../services/hr/attendanceService';
import { getActiveUnits } from '../../../services/master/unitService';
import { getActiveLeaveTypes } from '../../../services/master/hrMasterService';
import { importReviewColumns, hoursBetween } from './importReviewColumns';
import { useBranch } from '../../../context/BranchContext';
import { unitOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;


const AttendanceImport = () => {
  const { message } = App.useApp();
  const canAdd = hasPermission('hr-attendance', 'add');

  // Units of the working branch only; "All branches" lists every unit
  const { activeBranchId } = useBranch();
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(undefined);
  const [period, setPeriod] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState('SKIP');
  const [leaveTypes, setLeaveTypes] = useState([]);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined).then(setUnits).catch(() => {});
    // For the Leave Type cell on the review grid: a day the machine called absent is
    // often leave, and that is the correction somebody makes most.
    getActiveLeaveTypes().then(setLeaveTypes).catch(() => setLeaveTypes([]));
  }, [activeBranchId]);

  /**
   * A correction to one row, before anything is saved.
   *
   * The rows are what Import posts, so editing them here is the whole of it - no
   * second round trip, and no re-upload of a corrected file. Hours follow the punches
   * so the number being corrected towards moves as the time is typed; the server works
   * them out again on commit, from the employee's shift, and that is what is stored.
   */
  const editRow = useCallback((index, patch) => {
    setResult((current) => {
      if (!current) return current;
      const rows = [...current.rows];
      const next = { ...rows[index], ...patch };
      if ('inTime' in patch || 'outTime' in patch) {
        next.totalHours = hoursBetween(next.inTime, next.outTime);
      }
      rows[index] = next;
      return { ...current, rows };
    });
  }, []);

  const contextReady = Boolean(unitId && period?.[0] && period?.[1]);

  const params = useMemo(() => ({
    unitId,
    periodFrom: period?.[0]?.format('YYYY-MM-DD'),
    periodTo: period?.[1]?.format('YYYY-MM-DD'),
  }), [unitId, period]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadAttendanceTemplate(params);
      triggerBrowserDownload(blob, 'attendance-template.xlsx');
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    }
  }, [params]);

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
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
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
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setCommitting(false);
    }
  }, [result, duplicateStrategy, message]);

  /** Issues keyed by the row they belong to, so the grid can flag that row. */
  const issuesBy = useMemo(() => {
    const map = new Map();
    (result?.issues ?? []).forEach((issue) => {
      // rowNumber is 1-based and counts every row read, including the ones that
      // never made it into rows; matching on employee and date is what actually
      // lines an issue up with the row somebody has to correct.
      const index = (result?.rows ?? []).findIndex(
        (r) => r.employeeNo === issue.employeeNo && String(issue.message).includes(r.attendanceDate),
      );
      if (index < 0) return;
      map.set(index, [...(map.get(index) ?? []), issue]);
    });
    return map;
  }, [result]);

  const rowColumns = useMemo(
    () => importReviewColumns({
      // Editable once there is something to edit, which is also when it matters.
      editable: !committing,
      onEdit: editRow,
      leaveTypes,
      issuesBy,
    }),
    [committing, editRow, leaveTypes, issuesBy],
  );

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
            <div style={{ marginBottom: 4 }}><Text type="secondary">Unit</Text></div>
            <Select
              placeholder="Select unit"
              style={{ width: '100%' }}
              value={unitId}
              onChange={setUnitId}
              options={unitOptions(units)}
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
            {/* align="start" with the list hidden below: Upload used to render its
                own file row INSIDE itself, which made it two lines tall the moment
                a file was picked - and Space then centred Download Template and
                Validate against that taller neighbour, so the row of three buttons
                came apart. The chosen file now has a line of its own underneath,
                where its name can be as long as it likes. */}
            <Space wrap align="start">
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
                showUploadList={false}
                beforeUpload={(f) => { setFile(f); setResult(null); return false; }}
                fileList={file ? [file] : []}
              >
                <Button icon={<UploadOutlined />} disabled={!contextReady}>
                  {file ? 'Change File' : 'Select File'}
                </Button>
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

            {file && (
              <div className="attendance-import-file">
                <PaperClipOutlined className="attendance-import-file-icon" />
                <span className="attendance-import-file-name" title={file.name}>{file.name}</span>
                <Text type="secondary" className="attendance-import-file-size">
                  {(file.size / 1024).toFixed(0)} KB
                </Text>
                <Button
                  type="text"
                  size="small"
                  aria-label="Remove the selected file"
                  icon={<CloseOutlined />}
                  onClick={() => { setFile(null); setResult(null); }}
                />
              </div>
            )}
          </Col>
        </Row>

        {!contextReady && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            title="Choose a unit and period first. The template is generated for that unit's employees."
          />
        )}
      </Card>

      {result && (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}><Statistic title="Total Rows" value={result.totalRows} /></Col>
              <Col xs={12} sm={6}>
                <Statistic title="Ready to Import" value={result.validRows} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Warnings" value={result.warningRows} styles={{ content: { color: '#faad14' } }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="Errors" value={result.errorRows} styles={{ content: { color: '#ff4d4f' } }} />
              </Col>
            </Row>
          </Card>

          {result.issues?.length > 0 && (
            <Card size="small" title="Issues" style={{ marginBottom: 16 }}>
              <Table
                rowKey={(r) => `${r.rowNumber}-${r.field}-${result.issues.indexOf(r)}`}
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
            {/* Corrections happen here, not by editing the file and uploading it
                again. Nothing is saved until Import, and the server checks the
                edited rows on the way in. */}
            <Table
              rowKey={(r) => `${r.employeeId}-${r.attendanceDate}`}
              dataSource={result.rows}
              columns={rowColumns}
              size="small"
              pagination={{ pageSize: 25, showSizeChanger: true }}
              scroll={{ x: 1500 }}
            />
          </Card>
        </>
      )}
    </>
  );
};

export default AttendanceImport;
