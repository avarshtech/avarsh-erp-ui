import { useEffect, useState } from 'react';
import { Alert, App, Card, Descriptions, Spin, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton } from '../../components/buttons';
import { toastUnlessHandled } from '../../utils/apiError';
import { getAsset } from '../../services/asset/assetService';
import { conditionMeta, dash, statusMeta } from '../../utils/assetConstants';
import AssetMovementHistory from './components/AssetMovementHistory';
import AssetStatusHistory from './components/AssetStatusHistory';
import AssetStatusDialog from './components/AssetStatusDialog';
import AssetDocuments from './components/AssetDocuments';
import AssetMaintenancePanel from './components/AssetMaintenancePanel';
import AssetAssignmentPanel from './components/AssetAssignmentPanel';
import AssetDisposalDialog from './components/AssetDisposalDialog';
import { hasPermission } from '../../utils/permissions';
import AssetSpecList from './components/AssetSpecList';
import AssetLabelDialog from './components/AssetLabelDialog';

const date = (value) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
const money = (value) => (value === null || value === undefined ? '-' : `₹${Number(value).toLocaleString('en-IN')}`);

/** One asset in full, with the history of everywhere it has been. */
const AssetView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  // Bumped when the status is saved, so the history panel reloads rather than
  // sitting on the state from before the change.
  const [statusVersion, setStatusVersion] = useState(0);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const canUpdate = hasPermission('assets', 'update');
  const canDispose = hasPermission('asset-disposals', 'add');
  // Only once the asset is actually here. `asset?.status !== 'DISPOSED'` is TRUE
  // while it is still loading, so every asset briefly offered Change Status,
  // Edit and Dispose - a disposed one included - and the buttons then changed
  // under the reader. Nothing that depends on what the asset is may render
  // before it is known.
  const loaded = !!asset;
  const disposed = asset?.status === 'DISPOSED';

  /** Re-reads the asset after maintenance, whose dates and status live on it. */
  const reloadAsset = () => getAsset(id).then(setAsset).catch(() => {});

  // The fetch lives in the effect and the flag is set only in its callbacks:
  // setState in an effect body cascades renders, which the lint rejects. The
  // ignore flag drops an answer for an id the user has already navigated away
  // from, so a slow load cannot overwrite the asset now on screen.
  useEffect(() => {
    let ignore = false;
    getAsset(id)
      .then((loaded) => { if (!ignore) setAsset(loaded); })
      .catch((e) => { if (!ignore) toastUnlessHandled(message, e, 'Could not load the asset'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id, message]);

  const location = [asset?.unitName, asset?.departmentName, asset?.sectionName, asset?.lineName]
    .filter(Boolean).join(' / ');
  const supplier = asset?.supplierName ?? asset?.supplierText;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={asset?.assetId ?? 'Asset'}
        subtitle={asset?.name}
        onBack={() => navigate('/assets')}
      >
        <PermissionGuard module="assets" operation="view">
          <ActionButton action="print" text="Print Label" onClick={() => setLabelOpen(true)} />
        </PermissionGuard>
        {loaded && !disposed && (
          <PermissionGuard module="assets" operation="update">
            <ActionButton action="custom" text="Change Status" onClick={() => setStatusOpen(true)} />
            <ActionButton action="edit" text="Edit" onClick={() => navigate(`/assets/${id}/edit`)} />
          </PermissionGuard>
        )}
        {loaded && !disposed && canDispose && (
          <PermissionGuard module="asset-disposals" operation="add">
            {/* A second request is refused while one is open, so the button
                leads to the one that exists rather than taking a whole form
                and failing at the end of it. */}
            {asset?.openDisposal
              ? (
                <ActionButton
                  action="view"
                  // The state first. "Disposal DR/26-27/1001" reads as though the
                  // machine has already gone, when the request may only have been
                  // raised - or returned for correction.
                  text={`Disposal ${asset.openDisposal.statusLabel}`}
                  tooltip={`${asset.openDisposal.disposalNo} - open it to carry on`}
                  onClick={() => navigate(`/assets/disposals?highlight=${asset.openDisposal.id}`)}
                />
              )
              : <ActionButton action="delete" text="Dispose" onClick={() => setDisposeOpen(true)} />}
          </PermissionGuard>
        )}
      </PageHeader>

      {disposed && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`This asset was disposed on ${date(asset.statusChangedAt)}`}
          description={`${asset.statusReasonText ?? 'It has left the company.'} The record is kept for the auditor and nothing more can be done to it `
            + '- it cannot be edited, moved, serviced or issued. The status history below carries the disposal request it went out on.'}
        />
      )}

      <Spin spinning={loading}>
        {asset && (
          <>
            <Card title="Identification">
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
                items={[
                  {
                    key: 'status',
                    label: 'Status',
                    children: <Tag color={statusMeta(asset.status).color}>{statusMeta(asset.status).label}</Tag>,
                  },
                  {
                    key: 'condition',
                    label: 'Condition',
                    children: <Tag color={conditionMeta(asset.condition).color}>{conditionMeta(asset.condition).label}</Tag>,
                  },
                  // The reason sits beside the status it explains. "Idle" on its
                  // own is the half of the answer nobody needs.
                  {
                    key: 'why',
                    label: 'Why',
                    children: asset.statusReasonLabel
                      ? `${asset.statusReasonLabel}${asset.statusReasonText ? ` - ${asset.statusReasonText}` : ''}`
                      : '-',
                  },
                  {
                    key: 'since',
                    label: 'Since',
                    children: asset.statusChangedAt ? dayjs(asset.statusChangedAt).format('DD-MM-YYYY') : '-',
                  },
                  {
                    key: 'category',
                    label: 'Category',
                    children: asset.subCategoryName
                      ? `${asset.categoryName} / ${asset.subCategoryName}`
                      : dash(asset.categoryName),
                  },
                  { key: 'brand', label: 'Brand', children: dash(asset.brand) },
                  { key: 'model', label: 'Model', children: dash(asset.model) },
                  { key: 'manufacturer', label: 'Manufacturer', children: dash(asset.manufacturer) },
                  { key: 'serialNo', label: 'Serial no.', children: dash(asset.serialNo) },
                  { key: 'tagNo', label: 'Tag no.', children: dash(asset.tagNo) },
                  { key: 'remarks', label: 'Remarks', span: 3, children: dash(asset.remarks) },
                ]}
              />
              <AssetSpecList specData={asset.specData} fieldDefs={asset.fieldDefs} />
            </Card>

            <Card title="Location" style={{ marginTop: 16 }}>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  { key: 'location', label: 'Where it is', children: location || '-' },
                  { key: 'custodian', label: 'Custodian', children: dash(asset.custodianName) },
                  { key: 'assignedTo', label: 'Issued to', children: dash(asset.assignedToName) },
                ]}
              />
            </Card>

            <Card title="Purchase, warranty and AMC" style={{ marginTop: 16 }}>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
                items={[
                  { key: 'purchaseDate', label: 'Purchased on', children: date(asset.purchaseDate) },
                  { key: 'supplier', label: 'Supplier', children: dash(supplier) },
                  { key: 'cost', label: 'Cost', children: money(asset.purchaseCost) },
                  { key: 'invoiceNo', label: 'Invoice no.', children: dash(asset.invoiceNo) },
                  { key: 'poNo', label: 'PO no.', children: dash(asset.poNo) },
                  {
                    key: 'warranty',
                    label: 'Warranty',
                    children: asset.warrantyEnd ? `${date(asset.warrantyStart)} to ${date(asset.warrantyEnd)}` : '-',
                  },
                  {
                    key: 'amc',
                    label: 'AMC',
                    children: asset.amcAvailable ? `${date(asset.amcStart)} to ${date(asset.amcEnd)}` : 'No',
                  },
                  { key: 'amcVendor', label: 'AMC vendor', children: dash(asset.amcVendorName ?? asset.amcVendorText) },
                ]}
              />
            </Card>

            {/* Only for a category marked issuable: a compressor bolted to the
                floor has no business carrying an issue history. */}
            <AssetAssignmentPanel
              asset={asset}
              assignable={asset.categoryAssignable}
              canEdit={canUpdate}
              onAssetChanged={reloadAsset}
            />
            <AssetMaintenancePanel asset={asset} canEdit={canUpdate} onAssetChanged={reloadAsset} />
            <AssetDocuments assetId={asset.id} canEdit={canUpdate} />
            <AssetStatusHistory assetId={asset.id} refreshKey={statusVersion} />
            <AssetMovementHistory movements={asset.movements} />

            <AssetDisposalDialog
              open={disposeOpen}
              asset={asset}
              onClose={() => setDisposeOpen(false)}
              onRaised={(saved) => {
                setDisposeOpen(false);
                navigate(`/assets/disposals?highlight=${saved.id}`);
              }}
            />
            <AssetLabelDialog
              open={labelOpen}
              assets={[asset]}
              onClose={() => setLabelOpen(false)}
            />
            <AssetStatusDialog
              open={statusOpen}
              asset={asset}
              onClose={() => setStatusOpen(false)}
              onSaved={(saved) => { setAsset(saved); setStatusVersion((n) => n + 1); }}
            />
          </>
        )}
      </Spin>
    </div>
  );
};

export default AssetView;
