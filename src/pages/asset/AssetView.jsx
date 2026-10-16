import { useEffect, useState } from 'react';
import { App, Card, Descriptions, Spin, Tag } from 'antd';
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
        {asset?.status !== 'DISPOSED' && (
          <PermissionGuard module="assets" operation="update">
            <ActionButton action="custom" text="Change Status" onClick={() => setStatusOpen(true)} />
            <ActionButton action="edit" text="Edit" onClick={() => navigate(`/assets/${id}/edit`)} />
          </PermissionGuard>
        )}
        {asset?.status !== 'DISPOSED' && canDispose && (
          <PermissionGuard module="asset-disposals" operation="add">
            <ActionButton action="delete" text="Dispose" onClick={() => setDisposeOpen(true)} />
          </PermissionGuard>
        )}
      </PageHeader>

      <Spin spinning={loading}>
        {asset && (
          <>
            <Card title="Identification">
              <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
                <Descriptions.Item label="Status">
                  <Tag color={statusMeta(asset.status).color}>{statusMeta(asset.status).label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Condition">
                  <Tag color={conditionMeta(asset.condition).color}>{conditionMeta(asset.condition).label}</Tag>
                </Descriptions.Item>
                {/* The reason sits beside the status it explains. "Idle" on its
                    own is the half of the answer nobody needs. */}
                <Descriptions.Item label="Why">
                  {asset.statusReasonLabel
                    ? `${asset.statusReasonLabel}${asset.statusReasonText ? ` - ${asset.statusReasonText}` : ''}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Since">
                  {asset.statusChangedAt ? dayjs(asset.statusChangedAt).format('DD-MM-YYYY') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {asset.subCategoryName ? `${asset.categoryName} / ${asset.subCategoryName}` : dash(asset.categoryName)}
                </Descriptions.Item>
                <Descriptions.Item label="Brand">{dash(asset.brand)}</Descriptions.Item>
                <Descriptions.Item label="Model">{dash(asset.model)}</Descriptions.Item>
                <Descriptions.Item label="Manufacturer">{dash(asset.manufacturer)}</Descriptions.Item>
                <Descriptions.Item label="Serial no.">{dash(asset.serialNo)}</Descriptions.Item>
                <Descriptions.Item label="Tag no.">{dash(asset.tagNo)}</Descriptions.Item>
                <Descriptions.Item label="Remarks" span={3}>{dash(asset.remarks)}</Descriptions.Item>
              </Descriptions>
              <AssetSpecList specData={asset.specData} fieldDefs={asset.fieldDefs} />
            </Card>

            <Card title="Location" style={{ marginTop: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Where it is">{location || '-'}</Descriptions.Item>
                <Descriptions.Item label="Custodian">{dash(asset.custodianName)}</Descriptions.Item>
                <Descriptions.Item label="Issued to">{dash(asset.assignedToName)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Purchase, warranty and AMC" style={{ marginTop: 16 }}>
              <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
                <Descriptions.Item label="Purchased on">{date(asset.purchaseDate)}</Descriptions.Item>
                <Descriptions.Item label="Supplier">{dash(supplier)}</Descriptions.Item>
                <Descriptions.Item label="Cost">{money(asset.purchaseCost)}</Descriptions.Item>
                <Descriptions.Item label="Invoice no.">{dash(asset.invoiceNo)}</Descriptions.Item>
                <Descriptions.Item label="PO no.">{dash(asset.poNo)}</Descriptions.Item>
                <Descriptions.Item label="Warranty">
                  {asset.warrantyEnd ? `${date(asset.warrantyStart)} to ${date(asset.warrantyEnd)}` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="AMC">
                  {asset.amcAvailable ? `${date(asset.amcStart)} to ${date(asset.amcEnd)}` : 'No'}
                </Descriptions.Item>
                <Descriptions.Item label="AMC vendor">
                  {dash(asset.amcVendorName ?? asset.amcVendorText)}
                </Descriptions.Item>
              </Descriptions>
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
