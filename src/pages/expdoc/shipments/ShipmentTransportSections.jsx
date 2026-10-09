import { Form, Select } from 'antd';
import dayjs from 'dayjs';
import { FormSection, FormInput, FormSelect, FormDatePicker } from '../../../components/form';

/** ETA may not fall before ETD. */
const etaRule = ({ getFieldValue }) => ({
  validator: (_, value) => {
    const etd = getFieldValue('etd');
    if (value && etd && dayjs(value).isBefore(dayjs(etd), 'day')) {
      return Promise.reject(new Error('ETA cannot be before ETD'));
    }
    return Promise.resolve();
  },
});

/** The API's limits: at most 50 containers, each number at most 20 characters. */
const containersRule = {
  validator: (_, value) => {
    const numbers = (value || []).map((c) => String(c).trim()).filter(Boolean);
    if (numbers.length > 50) return Promise.reject(new Error('A shipment holds at most 50 containers'));
    if (numbers.some((c) => c.length > 20)) return Promise.reject(new Error('A container number has at most 20 characters'));
    return Promise.resolve();
  },
};

/** The shipment's routing and its container / BL fields — rendered inside the shipment Form. */
const ShipmentTransportSections = ({ portOptions }) => (
  <>
    <FormSection title="Routing" columns={3}>
      <Form.Item name="preCarriageBy" label="Pre-carriage by">
        <FormInput placeholder="ROAD" maxLength={30} />
      </Form.Item>
      <Form.Item name="placeOfReceipt" label="Place of receipt">
        <FormInput placeholder="Tiruppur" maxLength={100} />
      </Form.Item>
      <Form.Item name="vesselFlightNo" label="Vessel / Flight No.">
        <FormInput placeholder="MAERSK CHENNAI V.214W" maxLength={100} />
      </Form.Item>
      <Form.Item name="portOfLoading" label="Port of loading" rules={[{ required: true, message: 'Select the port of loading' }]}>
        <FormSelect options={portOptions} placeholder="Select port" />
      </Form.Item>
      <Form.Item name="portOfDischarge" label="Port of discharge" rules={[{ required: true, message: 'Select the port of discharge' }]}>
        <FormSelect options={portOptions} placeholder="Select port" />
      </Form.Item>
      <Form.Item name="finalDestination" label="Final destination">
        <FormInput placeholder="Valkenswaard, Netherlands" maxLength={150} />
      </Form.Item>
      <Form.Item name="countryOfFinalDestination" label="Country of final destination">
        <FormInput placeholder="Netherlands" maxLength={100} />
      </Form.Item>
      <Form.Item name="etd" label="ETD" rules={[{ required: true, message: 'Enter the ETD' }]}>
        <FormDatePicker />
      </Form.Item>
      <Form.Item name="eta" label="ETA" dependencies={['etd']} rules={[etaRule]}>
        <FormDatePicker />
      </Form.Item>
    </FormSection>

    <FormSection title="Container & Documents" columns={4}>
      <Form.Item
        name="containerNos"
        label="Container No(s)"
        tooltip="Type a number and press Enter to add another."
        rules={[containersRule]}
      >
        <Select mode="tags" tokenSeparators={[',']} placeholder="MSKU7712345" open={false} suffixIcon={null} />
      </Form.Item>
      <Form.Item name="blAwbNo" label="BL / AWB No.">
        <FormInput maxLength={50} />
      </Form.Item>
      <Form.Item name="blAwbDate" label="BL / AWB date">
        <FormDatePicker />
      </Form.Item>
      <Form.Item name="forwarder" label="Forwarder">
        <FormInput maxLength={150} />
      </Form.Item>
    </FormSection>
  </>
);

export default ShipmentTransportSections;
