import { useEffect } from 'react';
import { Button, Col, Form, InputNumber, Select, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { CURRENCIES } from '../../../../utils/costingConstants';
import { numericInputProps } from '../../../../utils/inputHelpers';
import { useSheet } from '../CostingSheetContext';

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const small = (text) => text && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{text}</Typography.Text>;

/**
 * Costing and quote currency, the Actual Rate this costing uses, and — read-only beside it —
 * today's market rate, live from the exchange API (the server's stored rate when the API cannot
 * be reached), saved with the sheet. A new sheet starts from today's rate until the user types
 * their own. When both currencies are the same, today's rate shown is USD→INR.
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

  const [from, to, todays, date, source] = same
    ? ['USD', 'INR', currency === 'INR' ? rates.usdRate : null, rates.usdRateDate, rates.usdRateSource]
    : [quoteCurrency, currency, rates.todaysRate, rates.rateDate, rates.rateSource];
  const live = source === 'LIVE';
  const applyToday = () => { form.setFieldValue('actualRate', round2(rates.todaysRate)); dispatch({ type: 'MARK_DIRTY' }); };

  const actualHint = same ? 'Same currency — no conversion.'
    : rates.missing ? `No ${quoteCurrency}→${currency} rate stored yet — enter it.`
      : rates.todaysRate && !inUse
        ? <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={applyToday}>Use today&apos;s rate</Button>
        : null;
  const todayHint = todays ? `${live ? 'Live' : 'Stored'}${date ? ` · ${dayjs(date).format('DD MMM')}` : ''}`
    : same && currency !== 'INR' ? 'No conversion' : 'Not available';
  const todayTip = todays
    ? `1 ${from} = ${todays} ${to} — ${live ? 'live market rate from the exchange API' : 'the live exchange API could not be reached; this is the rate the server stored'}. Not editable: Actual Rate is the one this costing uses.`
    : "Today's market rate, live from the exchange API.";

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
          label="Actual Rate" name="actualRate" extra={small(actualHint)}
          rules={[{ required: true, message: 'Enter the exchange rate' }, { type: 'number', min: 0.000001, message: 'Must be above zero' }]}
        >
          <InputNumber min={0} step={0.01} controls={false} style={{ width: '100%' }} {...numericInputProps} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item label="Today's Rate" htmlFor="todaysRate" extra={small(todayHint)}>
          <Tooltip title={todayTip}>
            <InputNumber id="todaysRate" name="todaysRate" value={todays ? round2(todays) : null} readOnly variant="filled"
              placeholder="—" controls={false} style={{ width: '100%' }} />
          </Tooltip>
        </Form.Item>
      </Col>
    </>
  );
}
