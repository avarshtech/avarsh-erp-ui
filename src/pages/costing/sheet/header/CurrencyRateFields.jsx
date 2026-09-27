import { useEffect } from 'react';
import { Button, Col, Form, InputNumber, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { CURRENCIES } from '../../../../utils/costingConstants';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Costing and quote currency, and the Actual Rate between them. The rate hint is the one the
 * server has stored (the same it saves with); a new sheet takes it until the user types their
 * own. With no stored rate the hint says so rather than inventing one.
 */
export default function CurrencyRateFields() {
  const { form, rates, isNew, dispatch } = useSheet();
  const currency = Form.useWatch('currency', form);
  const quoteCurrency = Form.useWatch('quoteCurrency', form);
  const actualRate = Form.useWatch('actualRate', form);
  const same = currency && currency === quoteCurrency;
  const inUse = rates.todaysRate && round2(actualRate) === round2(rates.todaysRate);

  useEffect(() => {
    if (!isNew || form.isFieldTouched('actualRate')) return;
    if (same) form.setFieldValue('actualRate', 1);
    else if (rates.todaysRate) form.setFieldValue('actualRate', round2(rates.todaysRate));
  }, [isNew, same, rates.todaysRate, form]);

  const applyStored = () => { form.setFieldValue('actualRate', round2(rates.todaysRate)); dispatch({ type: 'MARK_DIRTY' }); };
  const hint = same ? 'Same currency — no conversion.'
    : rates.missing ? `No ${quoteCurrency}→${currency} rate stored yet — enter it.`
      : rates.todaysRate ? (
        <span>
          Stored rate {round2(rates.todaysRate)}{rates.rateDate ? ` (${dayjs(rates.rateDate).format('DD MMM')})` : ''}{' '}
          {!inUse && <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={applyStored}>Use</Button>}
        </span>
      ) : null;

  return (
    <>
      <Col xs={12} md={6}>
        <Form.Item label="Costing Currency" name="currency" rules={[{ required: true }]}>
          <Select options={CURRENCIES} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item label="Quote Currency" name="quoteCurrency" rules={[{ required: true }]}>
          <Select options={CURRENCIES} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item
          label="Actual Rate" name="actualRate"
          extra={hint && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{hint}</Typography.Text>}
          rules={[{ required: true, message: 'Enter the exchange rate' }, { type: 'number', min: 0.000001, message: 'Must be above zero' }]}
        >
          <InputNumber min={0} step={0.01} controls={false} style={{ width: '100%' }} {...numericInputProps} />
        </Form.Item>
      </Col>
    </>
  );
}
