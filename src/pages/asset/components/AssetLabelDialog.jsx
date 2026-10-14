import { useState } from 'react';
import { App, InputNumber, Modal, Radio, Space } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { LABEL_STOCKS, printAssetLabels } from '../../../utils/assetLabelPrint';
import { assetLabelUrl } from '../../../utils/qrSvg';
import { companyForPrint } from '../../../utils/printCompany';
import { toastUnlessHandled } from '../../../utils/apiError';

const STOCKS = Object.values(LABEL_STOCKS);

/**
 * Printing the stickers that go on the machines.
 *
 * The preview is drawn at the stock's real proportions so what comes out of the
 * printer is no surprise - a 50mm label with a long machine name is the usual
 * way a label sheet gets wasted.
 */
const AssetLabelDialog = ({ open, assets = [], onClose }) => {
  const { message } = App.useApp();
  const [stockKey, setStockKey] = useState(LABEL_STOCKS.LARGE.key);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);

  const stock = LABEL_STOCKS[stockKey];
  const rows = assets.filter(Boolean);
  const sample = rows[0];
  const total = rows.length * copies;
  const specs = [sample?.model && `Model ${sample.model}`, sample?.serialNo && `SL ${sample.serialNo}`]
    .filter(Boolean).join('  ');
  const place = [sample?.unitName, sample?.departmentName].filter(Boolean).join(' / ');

  const run = async () => {
    setPrinting(true);
    try {
      const org = await companyForPrint();
      const opened = printAssetLabels(rows, {
        stock, copies, companyName: org?.organisationName ?? '',
      });
      if (!opened) message.warning('Your browser blocked the print window — allow pop-ups for this site.');
      else onClose();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not build the labels');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal
      title={rows.length === 1 ? `Print label — ${sample?.assetId ?? ''}` : `Print ${rows.length} labels`}
      open={open}
      onCancel={onClose}
      onOk={run}
      okText={`Print ${total} label${total === 1 ? '' : 's'}`}
      confirmLoading={printing}
      okButtonProps={{ disabled: !rows.length }}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Label stock</div>
          <Radio.Group
            value={stockKey}
            onChange={(e) => setStockKey(e.target.value)}
            options={STOCKS.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Copies of each</div>
          <InputNumber min={1} max={10} value={copies} onChange={(v) => setCopies(v || 1)} />
        </div>

        {sample && (
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Preview</div>
            {/* 3.2px per mm keeps the preview the stock's real shape. */}
            <div className="asset-label-preview" style={{ width: stock.widthMm * 3.2, height: stock.heightMm * 3.2 }}>
              <div className="all-text">
                <div className="co">Company Name</div>
                <div className="code" style={{ fontSize: stock.compact ? 12 : 17 }}>{sample.assetId}</div>
                <div className="nm">{sample.name}</div>
                {specs && <div className="sp">{specs}</div>}
                <div className="un">{place}</div>
              </div>
              <QRCodeSVG value={assetLabelUrl(sample.assetId)} size={stock.compact ? 48 : 70} level="M" marginSize={0} />
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              Scanning the QR opens this asset. Set the paper to <strong>{stock.label}</strong> in the print
              dialog — browsers do not all honour the size the page asks for.
            </div>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default AssetLabelDialog;
