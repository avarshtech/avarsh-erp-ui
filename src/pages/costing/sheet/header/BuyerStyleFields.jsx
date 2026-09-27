import { Button, Col, Form, Image, Input, Space, Tooltip } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import CreatableSelect from '../../../../components/quickcreate/CreatableSelect';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { SEASON_CODES } from '../../../../utils/costingConstants';
import { useSheet } from '../CostingSheetContext';
import useStyleImage from '../hooks/useStyleImage';

const seasonLabel = (code, year) =>
  [SEASON_CODES.find((s) => s.value === code)?.label, year].filter(Boolean).join(' ');

/**
 * Buyer, style and what the style decides (garment, season). A new buyer or style is created
 * in place; a new style is selected as soon as it is saved.
 */
export default function BuyerStyleFields() {
  const { form, masters, styles, dispatch, openDialog } = useSheet();
  const { open } = useQuickCreate();
  const buyerId = Form.useWatch('buyerId', form);
  const styleId = Form.useWatch('styleNo', form);
  const season = seasonLabel(Form.useWatch('seasonCode', form), Form.useWatch('seasonYear', form));
  const styleImage = useStyleImage(styleId);
  const buyerName = masters.buyerOptions.find((b) => b.value === buyerId)?.label;

  const clearStyle = () => form.setFieldsValue({ styleNo: undefined, garmentName: '', seasonCode: undefined, seasonYear: undefined });
  const pickStyle = (style) => {
    form.setFieldsValue({
      styleNo: style.id, garmentName: style.garmentName || '', seasonCode: style.seasonCode || undefined, seasonYear: style.seasonYear || undefined,
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  return (
    <>
      <Form.Item name="seasonCode" hidden noStyle><Input /></Form.Item>
      <Form.Item name="seasonYear" hidden noStyle><Input /></Form.Item>
      <Col xs={24} md={8}>
        <Form.Item name="buyerId" rules={[{ required: true, message: 'Buyer is required' }]} label={(
          <Space size={4}>Buyer{buyerId && (
            <Tooltip title="Buyer price trend">
              <Button type="link" size="small" icon={<BarChartOutlined />} aria-label="Buyer price trend"
                style={{ padding: 0, height: 'auto' }} onClick={() => openDialog('priceTrend')} />
            </Tooltip>
          )}</Space>
        )}>
          <CreatableSelect
            placeholder="Select buyer" options={masters.buyerOptions} createType="buyer" onChange={clearStyle}
            onCreate={(text) => open('buyer', {
              prefill: { text },
              onCreated: (buyer) => { masters.addBuyer(buyer); form.setFieldValue('buyerId', buyer.id); clearStyle(); dispatch({ type: 'MARK_DIRTY' }); },
            })}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="styleNo" label="Style #" rules={[{ required: true, message: 'Style # is required' }]}
          extra={buyerId ? undefined : 'Pick the buyer first'}>
          <CreatableSelect
            placeholder="Select style" options={styles.options} loading={styles.loading} disabled={!buyerId} createType="style"
            onChange={(_, option) => option?.style && pickStyle(option.style)}
            onCreate={(text) => open('style', {
              prefill: { text, buyerId, buyerName },
              onCreated: (style) => { styles.addStyle(style); pickStyle(style); },
            })}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Space align="start" style={{ width: '100%' }}>
          <Form.Item name="garmentName" label="Garment Name" extra={season || undefined} style={{ flex: 1 }}>
            <Input readOnly variant="filled" placeholder="From the style" />
          </Form.Item>
          {styleImage && <Image src={styleImage} alt="Style" width={56} height={56} style={{ objectFit: 'cover', borderRadius: 8, marginTop: 26 }} />}
        </Space>
      </Col>
    </>
  );
}
