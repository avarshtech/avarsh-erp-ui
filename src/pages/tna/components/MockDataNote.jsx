import { memo } from 'react';
import { Tag, Tooltip } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { USE_MOCK_TNA_DATA } from '../../../services/tna/tnaEnv';
import { fmtDate } from '../../../utils/tnaConstants';

/** Says plainly that Round 1 runs on mock source events; disappears when the API lands. */
const MockDataNote = memo(function MockDataNote({ asOf }) {
  if (!USE_MOCK_TNA_DATA) return null;
  return (
    <Tooltip title="CR-TNA-001 Round 1: every date is derived by the scheduling engine from mock source events. Round 2 connects the live Order, BOM, Sampling, Purchase, Stores, QC and Production records.">
      <Tag icon={<ExperimentOutlined />} color="purple" style={{ marginInlineEnd: 0 }}>
        Mock source data{asOf ? ` · as of ${fmtDate(asOf)}` : ''}
      </Tag>
    </Tooltip>
  );
});

export default MockDataNote;
