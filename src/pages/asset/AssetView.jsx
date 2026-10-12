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
import AssetSpecList from './components/AssetSpecList';

const date = (value) => (value ? dayjs(value).format('DD-MM-YYYY') : '-');
const money = (value) => (value === null || value === undefined ? '-' : `₹${Number(value).toLocaleString('en-IN')}`);

/** One asset in full, with the history of everywhere it has been. */
const AssetView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);

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
        {asset?.status !== 'DISPOSED' && (
          <PermissionGuard module="assets" operation="update">
            <ActionButton action="edit" text="Edit" onClick={() => navigate(`/assets/${id}/edit`)} />
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
                <Descriptions.Item label="AMC vendor">{dash(asset.amcVendorName)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <AssetMovementHistory movements={asset.movements} />
          </>
        )}
      </Spin>
    </div>
  );
};

export default AssetView;
