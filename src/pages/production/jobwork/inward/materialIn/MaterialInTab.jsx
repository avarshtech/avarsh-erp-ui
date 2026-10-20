import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Empty, Table, Typography,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import SearchFilterBar from '../../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../../hooks/useDebouncedSearch';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { cancelInward, getInwardReport, searchInwards } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { buildShortageReportHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { INWARD_STATUS_LABEL, toOptions } from '../../../../../utils/jobWorkInward/inwardConstants';
import ReasonModal from '../../components/ReasonModal';
import materialInColumns from './materialInColumns';

const { Text } = Typography;
const KEY = 'production-job-work';

/** Every receipt of a principal's material on their challan; it becomes their stock, never ours. */
const MaterialInTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [principalId, setPrincipalId] = useState();
  const [status, setStatus] = useState();
  const [rows, setRows] = useState([]);
  const [principals, setPrincipals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { listInwardFilterOptions().then((o) => setPrincipals(o.principals)).catch(() => {}); }, [refresh]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await searchInwards({ q: debouncedSearch, principalId, status });
        if (alive) setRows(r);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load Material In.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, principalId, status, refresh, message]);

  const columns = useMemo(() => materialInColumns({
    onOpenJob: actions.openJobOrder,
    onReport: async (id) => {
      try { const d = await getInwardReport(id); actions.openPrint({ title: `Shortage & defect report — ${d.doc.inwardNo}`, html: buildShortageReportHtml(d) }); } catch (e) { toastUnlessHandled(message, e); }
    },
    onCancel: setCancelling,
    canCancel: hasPermission(KEY, 'cancel'),
  }), [actions, message]);

  return (
    <Card size="small">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Their fabric, trims or cut panels arrive on their challan. Each line becomes a lot they own: held for them, never valued, never used for another order.
      </Text>
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search Material In, their challan, order, style, principal, e-way bill"
        filters={[
          { type: 'select', key: 'p', props: { placeholder: 'Principal', value: principalId, options: principals, onChange: setPrincipalId } },
          { type: 'select', key: 's', span: { lg: 4 }, props: { placeholder: 'Status', value: status, options: toOptions(INWARD_STATUS_LABEL), onChange: setStatus } },
        ]}
        extra={<Button type="primary" icon={<InboxOutlined />} disabled={!hasPermission(KEY, 'receive')} onClick={() => actions.recordInward(null)}>Record material in</Button>}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1650, y: 'calc(100vh - 400px)' }}
        pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Nothing received from principals yet." /> }}
      />
      {cancelling && (
        <ReasonModal title={`Cancel ${cancelling.inwardNo}`} okText="Cancel Material In" placeholder="Why is it cancelled?"
          onSubmit={async (reason) => { await cancelInward(cancelling.id, { reason }); message.success(`${cancelling.inwardNo} cancelled.`); actions.changed(); }}
          onClose={() => setCancelling(null)}>
          <Alert type="warning" showIcon title="Only before any of this material has moved — issued, returned or written off." />
        </ReasonModal>
      )}
    </Card>
  );
};

export default MaterialInTab;
