import { Button, InputNumber, Popover, Tooltip } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { formatConversionLabel } from '../../../../utils/uomConversions';
import { useSheet } from '../CostingSheetContext';
import PastPriceList from './PastPriceList';

/**
 * The rate, quoted per the item's PURCHASE unit ("/kg"). Where the consumption unit differs the
 * tooltip spells out the bridge ("1 kg = 1000 g"). The history button shows what the material
 * was last costed and last bought at, one click to use a price.
 */
export default function RateCell({ sectionKey, spec, record }) {
  const { dispatch, header, pastPrices } = useSheet();
  const update = (value) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch: { [spec.field]: value } });
  const rateCurrency = spec.currency === 'USD' ? 'USD' : header.currency;
  const bridge = Number(record.uomConversionFactor) > 0 && record.primaryUom && record.uom
    ? formatConversionLabel(record.primaryUom, record.uom, record.uomConversionFactor)
    : null;

  const input = (
    <InputNumber
      name="rate" value={record[spec.field]} min={0} step={0.01} controls={false} placeholder={spec.placeholder}
      size="small" style={{ flex: 1, minWidth: 0 }} suffix={record.primaryUom ? `/${record.primaryUom}` : undefined}
      onChange={update} {...numericInputProps}
    />
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {bridge ? <Tooltip title={bridge}>{input}</Tooltip> : input}
      {record.variantId && (
        <Popover
          trigger="click"
          title="Past prices"
          onOpenChange={(open) => open && pastPrices.load(record.variantId)}
          content={<PastPriceList prices={pastPrices.prices[record.variantId]} rateCurrency={rateCurrency} onUse={update} />}
        >
          <Button size="small" type="text" icon={<HistoryOutlined />} aria-label="Last purchase prices" />
        </Popover>
      )}
    </div>
  );
}
