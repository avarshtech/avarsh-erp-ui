import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, Empty, Table,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import SearchFilterBar from '../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../../utils/paginationConfig';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import { cancelReceipt, searchReceipts } from '../../../../services/production/jobwork/jobWorkReceiptApi';
import { listFilterOptions } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { RECEIPT_STATUS_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';
import ReasonModal from '../components/ReasonModal';
import { fmtQty } from '../jwFormat';
import receiptColumns, { renderReceiptLines } from './receiptColumns';

/** Every receipt from vendors; "Receive from vendor" opens the drawer with a job picker. */
const ReceiptsTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [vendorId, setVendorId] = useState();
  const [status, setStatus] = useState();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25 });
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { listFilterOptions().then((o) => setVendors(o.vendors)).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const page = await searchReceipts({ q: debouncedSearch, vendorId, status, page: pagination.current - 1, size: pagination.pageSize });
        if (alive) setData(page);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load receipts.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, vendorId, status, pagination, refresh, message]);

  const columns = useMemo(() => receiptColumns({
    onOpenJob: actions.openJob, onCancel: setCancelling, canCancel: hasPermission('production-job-work', 'cancel'),
  }), [actions]);

  const doCancel = async (reason) => {
    const res = await cancelReceipt(cancelling.id, { reason });
    message.success(`${cancelling.receiptNo} cancelled${res.jobStatus === 'IN_PROGRESS' ? '; the job is open again' : ''}.`);
    actions.changed();
  };

  return (
    <Card size="small">
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search receipt, job, order, style, vendor, DC"
        filters={[
          { type: 'select', key: 'v', props: { placeholder: 'Vendor', value: vendorId, options: vendors, onChange: setVendorId } },
          { type: 'select', key: 's', span: { lg: 4 }, props: { placeholder: 'Status', value: status, options: toOptions(RECEIPT_STATUS_LABEL), onChange: setStatus } },
        ]}
        extra={<Button type="primary" icon={<InboxOutlined />} disabled={!hasPermission('production-job-work', 'receive')} onClick={() => actions.openReceipt(null)}>Receive from vendor</Button>}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={data.content}
        expandable={{ expandedRowRender: renderReceiptLines }}
        scroll={{ x: 1450, y: 'calc(100vh - 360px)' }}
        pagination={getTablePagination({ ...pagination, total: data.totalElements }, 'receipts')}
        onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
        locale={{ emptyText: <Empty description="Nothing received from vendors yet." /> }}
      />
      {cancelling && (
        <ReasonModal title={`Cancel ${cancelling.receiptNo}`} okText="Cancel receipt" placeholder="Why is this receipt being cancelled?"
          onSubmit={doCancel} onClose={() => setCancelling(null)}>
          <Alert type="warning" showIcon title={`${fmtQty(cancelling.good + cancelling.rejected)} pieces at ${cancelling.stageLabel} come off the job's received figures. A completed job opens again; a closed job stays closed.`} />
        </ReasonModal>
      )}
    </Card>
  );
};

export default ReceiptsTab;
