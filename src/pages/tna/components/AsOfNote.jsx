import { memo } from 'react';
import { Tag, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { fmtDate } from '../../../utils/tnaConstants';

/** Says where the figures come from: the live source records, evaluated as of today. */
const AsOfNote = memo(function AsOfNote({ asOf }) {
  return (
    <Tooltip title="Every date is taken from the Order, BOM, Sampling, Purchase, Stores, QC, Production and Export Docs records as they are saved; only PP meeting, pattern release and First Bulk Piece are recorded here.">
      <Tag icon={<SyncOutlined />} color="green" style={{ marginInlineEnd: 0 }}>
        Live from source records{asOf ? ` · as of ${fmtDate(asOf)}` : ''}
      </Tag>
    </Tooltip>
  );
});

export default AsOfNote;
