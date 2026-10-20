import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Card, Empty, Space, Switch, Table, Typography,
} from 'antd';
import SearchFilterBar from '../../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../../hooks/useDebouncedSearch';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { getPartyStock } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import partyStockColumns from './partyStockColumns';
import IssueToProductionDrawer from './IssueToProductionDrawer';
import LotActionModal from './LotActionModal';
import WasteSaleModal from './WasteSaleModal';

const { Text } = Typography;
const KEY = 'production-job-work';

/** The principals' material with us — held for them, never our stock — and what can be done with it. */
const PartyStockTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [principalId, setPrincipalId] = useState();
  const [jobOrderId, setJobOrderId] = useState();
  const [showAll, setShowAll] = useState(false);
  const [tree, setTree] = useState([]);
  const [options, setOptions] = useState({ principals: [], jobOrders: [] });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);

  useEffect(() => { listInwardFilterOptions().then(setOptions).catch(() => {}); }, [refresh]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const t = await getPartyStock({ q: debouncedSearch, principalId, jobOrderId, showAll });
        if (alive) setTree(t);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load party stock.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, principalId, jobOrderId, showAll, refresh, message]);

  const columns = useMemo(() => partyStockColumns({
    onOpenJob: actions.openJobOrder,
    onIssue: (lot) => setDialog({ kind: 'issue', lot }),
    onMove: (lot) => setDialog({ kind: 'MOVE', lot }),
    onWriteOff: (lot) => setDialog({ kind: 'WRITE_OFF', lot }),
    onSellWaste: (order) => setDialog({ kind: 'waste', order }),
    can: { add: hasPermission(KEY, 'add'), receive: hasPermission(KEY, 'receive'), cancel: hasPermission(KEY, 'cancel') },
  }), [actions]);
  const done = () => { setDialog(null); actions.changed(); };

  return (
    <Card size="small">
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Held for the principal — not our stock"
        description="Never valued and never used for our own orders. In store is what is on our racks; not yet accounted adds what went into production and is not yet back as garments. The principal must have it back within a year of their challan." />
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search lot, material, their challan, order, colour"
        filters={[
          { type: 'select', key: 'p', props: { placeholder: 'Principal', value: principalId, options: options.principals, onChange: (v) => { setPrincipalId(v); setJobOrderId(undefined); } } },
          { type: 'select', key: 'o', props: { placeholder: 'Job order', value: jobOrderId, options: options.jobOrders.filter((o) => !principalId || o.principalId === principalId), onChange: setJobOrderId } },
        ]}
        extra={<Space><Text type="secondary">Settled lots too</Text><Switch size="small" checked={showAll} onChange={setShowAll} /></Space>}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="key"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={tree}
        pagination={false}
        expandable={{ defaultExpandAllRows: true }}
        key={tree.map((p) => p.key).join()}
        scroll={{ x: 1600, y: 'calc(100vh - 420px)' }}
        locale={{ emptyText: <Empty description="Nothing of the principals' is with us." /> }}
      />
      {dialog?.kind === 'issue' && <IssueToProductionDrawer jobOrderId={dialog.lot.jobOrderId} presetLotId={dialog.lot.id} onClose={() => setDialog(null)} onSaved={done} />}
      {(dialog?.kind === 'MOVE' || dialog?.kind === 'WRITE_OFF') && <LotActionModal mode={dialog.kind} lot={dialog.lot} jobOrders={options.jobOrders} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === 'waste' && <WasteSaleModal order={dialog.order} onClose={() => setDialog(null)} onSaved={done} />}
    </Card>
  );
};

export default PartyStockTab;
