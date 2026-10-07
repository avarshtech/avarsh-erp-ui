import { memo } from 'react';
import {
  Alert, Checkbox, Col, DatePicker, Input, Row, Segmented, Select, Typography,
} from 'antd';
import dayjs from 'dayjs';
import {
  FLAG_LABEL, ISSUE_CATEGORY_LABEL, SOURCE_LABEL, toOptions,
} from '../../../../utils/jobWorkTracker/constants';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import StageEntryGrid from './StageEntryGrid';

const { Text } = Typography;
const FLAGS = toOptions(FLAG_LABEL);
const ISSUES = toOptions(ISSUE_CATEGORY_LABEL);
const SOURCES = toOptions(SOURCE_LABEL);

/** One job on the vendor's sheet: today's figures, the flag, the vendor's revised date, the issue. */
const VendorJobCard = memo(function VendorJobCard({ job, errors, onCell, onField }) {
  const disabled = job.readOnly;
  const set = (field) => (v) => onField(job.jobId, field, v);
  return (
    <>
      {job.readOnly && <Alert type="info" showIcon style={{ marginBottom: 8 }} title={job.readOnlyReason} />}
      <StageEntryGrid job={job} errors={errors} disabled={disabled} onCell={onCell} />
      <Row gutter={[12, 8]} style={{ marginTop: 10 }} align="bottom">
        <Col xs={24} md={9}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>How is it going?</Text>
          <Segmented name={`flag-${job.jobId}`} size="small" options={FLAGS} value={job.flag} disabled={disabled} onChange={set('flag')} />
        </Col>
        <Col xs={12} md={5}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Vendor&apos;s revised date</Text>
          <DatePicker
            name={`revised-${job.jobId}`}
            size="small"
            format={DATE_FORMAT}
            style={{ width: '100%' }}
            disabled={disabled}
            value={job.revisedDue ? dayjs(job.revisedDue) : null}
            onChange={(d) => set('revisedDue')(d ? d.format('YYYY-MM-DD') : null)}
          />
        </Col>
        <Col xs={12} md={5}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Source</Text>
          <Select name={`source-${job.jobId}`} size="small" style={{ width: '100%' }} options={SOURCES} value={job.source} disabled={disabled} onChange={set('source')} />
        </Col>
        <Col xs={24} md={5}>
          <Checkbox name={`nomove-${job.jobId}`} checked={job.noMovement} disabled={disabled} onChange={(e) => set('noMovement')(e.target.checked)}>
            Checked — no movement
          </Checkbox>
        </Col>
        <Col xs={24} md={9}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Issue</Text>
          <Select name={`issue-${job.jobId}`} size="small" style={{ width: '100%' }} options={ISSUES} value={job.issueCategory} disabled={disabled} onChange={set('issueCategory')} />
        </Col>
        <Col xs={24} md={15}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Remarks</Text>
          <Input name={`remarks-${job.jobId}`} size="small" value={job.remarks} disabled={disabled} maxLength={300}
            placeholder="What the vendor said" onChange={(e) => set('remarks')(e.target.value)} />
        </Col>
      </Row>
    </>
  );
});

export default VendorJobCard;
