import { Form, Select } from 'antd';
import dayjs from 'dayjs';
import { FormSection, FormInput, FormSelect, FormDatePicker } from '../../../components/form';

// Every field is mandatory (the owner's rule, 2026-10-09) except the BL/AWB number and date,
// issued only once the cargo is loaded. The API refuses the same.
const required = (message) => [{ required: true, whitespace: true, message }];

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

/**
 * A sea shipment travels in containers, so it needs at least one; air and courier have none.
 * The API's limits: at most 50 containers, each number at most 20 characters.
 */
const containersRule = ({ getFieldValue }) => ({
  validator: (_, value) => {
    const numbers = (value || []).map((c) => String(c).trim()).filter(Boolean);
    if (getFieldValue('mode') === 'SEA' && !numbers.length) {
      return Promise.reject(new Error('Enter the container number(s): a sea shipment travels in containers'));
    }
    if (numbers.length > 50) return Promise.reject(new Error('A shipment holds at most 50 containers'));
    if (numbers.some((c) => c.length > 20)) return Promise.reject(new Error('A container number has at most 20 characters'));
    return Promise.resolve();
  },
});

/**
 * The shipment's routing and its container / BL fields — rendered inside the shipment Form.
 * `containersRequired`: the mode is Sea.
 */
const ShipmentTransportSections = ({ portOptions, containersRequired }) => (
  <>
    <FormSection title="Routing" columns={3}>
      <Form.Item name="preCarriageBy" label="Pre-carriage by" rules={required('Enter the pre-carriage')}>
        <FormInput placeholder="ROAD" maxLength={30} />
      </Form.Item>
      <Form.Item name="placeOfReceipt" label="Place of receipt" rules={required('Enter the place of receipt')}>
        <FormInput placeholder="Tiruppur" maxLength={100} />
      </Form.Item>
      <Form.Item name="vesselFlightNo" label="Vessel / Flight No." rules={required('Enter the vessel or flight no.')}>
        <FormInput placeholder="MAERSK CHENNAI V.214W" maxLength={100} />
      </Form.Item>
      <Form.Item name="portOfLoading" label="Port of loading" rules={[{ required: true, message: 'Select the port of loading' }]}>
        <FormSelect options={portOptions} placeholder="Select port" />
      </Form.Item>
      <Form.Item name="portOfDischarge" label="Port of discharge" rules={[{ required: true, message: 'Select the port of discharge' }]}>
        <FormSelect options={portOptions} placeholder="Select port" />
      </Form.Item>
      <Form.Item name="finalDestination" label="Final destination" rules={required('Enter the final destination')}>
        <FormInput placeholder="Valkenswaard, Netherlands" maxLength={150} />
      </Form.Item>
      <Form.Item
        name="countryOfFinalDestination"
        label="Country of final destination"
        rules={required('Enter the country of final destination')}
      >
        <FormInput placeholder="Netherlands" maxLength={100} />
      </Form.Item>
      <Form.Item name="etd" label="ETD" rules={[{ required: true, message: 'Enter the ETD' }]}>
        <FormDatePicker />
      </Form.Item>
      <Form.Item name="eta" label="ETA" dependencies={['etd']} rules={[{ required: true, message: 'Enter the ETA' }, etaRule]}>
        <FormDatePicker />
      </Form.Item>
    </FormSection>

    <FormSection title="Container & Documents" columns={4}>
      <Form.Item
        name="containerNos"
        label="Container No(s)"
        tooltip="Type a number and press Enter to add another. Needed for a sea shipment; air and courier have none."
        required={containersRequired}
        dependencies={['mode']}
        rules={[containersRule]}
      >
        <Select mode="tags" tokenSeparators={[',']} placeholder="MSKU7712345" open={false} suffixIcon={null} />
      </Form.Item>
      <Form.Item name="blAwbNo" label="BL / AWB No." tooltip="Issued once the cargo is loaded: fill it in then.">
        <FormInput maxLength={50} />
      </Form.Item>
      <Form.Item name="blAwbDate" label="BL / AWB date">
        <FormDatePicker />
      </Form.Item>
      <Form.Item name="forwarder" label="Forwarder" rules={required('Enter the forwarder')}>
        <FormInput maxLength={150} />
      </Form.Item>
    </FormSection>
  </>
);

export default ShipmentTransportSections;
