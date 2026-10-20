import { useEffect, useState } from 'react';
import {
  Card, Segmented, Skeleton, Typography,
} from 'antd';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import PartyStatement from './PartyStatement';
import ChargesStatement from './ChargesStatement';
import StatusReport from './StatusReport';

const { Text } = Typography;
const VIEWS = [
  { value: 'party', label: 'Party statement' },
  { value: 'charges', label: 'Job charges for Tally' },
  { value: 'status', label: 'Status report' },
];
const NOTE = {
  party: 'Their material in and out, lot by lot, with the fabric accounts — what the principal reconciles at closing.',
  charges: 'One line per return: good pieces × the job rate, with CGST + SGST or IGST by their state. The accountant raises the invoice in Tally and records its number here.',
  status: 'Progress per colour and day by day, from the cutting, sewing and packing figures — nobody types it twice.',
};

/** The three statements of inward job work. */
const StatementsTab = ({ refresh, actions }) => {
  const [view, setView] = useState('party');
  const [options, setOptions] = useState(null);
  useEffect(() => { listInwardFilterOptions().then(setOptions).catch(() => setOptions({ principals: [], jobOrders: [] })); }, [refresh]);
  return (
    <Card size="small">
      <Segmented value={view} options={VIEWS} onChange={setView} style={{ marginBottom: 8 }} />
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{NOTE[view]}</Text>
      {!options && <Skeleton active />}
      {options && view === 'party' && <PartyStatement options={options} refresh={refresh} />}
      {options && view === 'charges' && <ChargesStatement options={options} refresh={refresh} onChanged={actions.changed} />}
      {options && view === 'status' && <StatusReport options={options} refresh={refresh} />}
    </Card>
  );
};

export default StatementsTab;
