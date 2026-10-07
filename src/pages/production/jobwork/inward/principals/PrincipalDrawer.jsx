import { useState } from 'react';
import {
  Alert, App, Button, Col, Drawer, Input, InputNumber, Radio, Row, Select, Space, Typography,
} from 'antd';
import { savePrincipal } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { validatePrincipal } from '../../../../../utils/jobWorkInward/orderRules';
import { WASTE_RULE_LABEL, toOptions } from '../../../../../utils/jobWorkInward/inwardConstants';
import { INDIAN_STATE_CODES, getStateName } from '../../../../../utils/indianStates';
import { toastUnlessHandled } from '../../../../../utils/apiError';

const { Text } = Typography;
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{children}</Text>;
const STATES = Object.entries(INDIAN_STATE_CODES).map(([value, name]) => ({ value, label: `${value} — ${name}` }));
const EMPTY = { name: '', gstin: '', stateCode: undefined, city: '', address: '', pincode: '', contactPerson: '', phone: '', email: '', wasteRule: 'RETURN', weightTolerancePct: 1 };

/** Preview of the Buyer master's new fields for a company we do job work for. */
const PrincipalDrawer = ({ principal, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [p, setP] = useState(principal ? { ...EMPTY, ...principal, gstin: principal.gstin || '' } : EMPTY);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (x) => setP((v) => ({ ...v, ...x }));
  const gstin = p.gstin.trim().toUpperCase();
  const errors = validatePrincipal(p);
  const save = async () => {
    setTried(true);
    if (errors.length) return;
    setBusy(true);
    try {
      await savePrincipal({ ...p, gstin });
      message.success(`${p.name} saved.`);
      onSaved();
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  return (
    <Drawer open size={720} destroyOnHidden onClose={onClose} title={principal ? `Principal — ${principal.name}` : 'New principal'}
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={busy} onClick={save}>Save</Button></Space>}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="A principal is a buyer we do job work for: these are the Buyer master's new fields." />
      <Row gutter={[12, 12]}>
        <Col span={24}><Label>Company name</Label><Input name="prName" value={p.name} onChange={(e) => set({ name: e.target.value })} /></Col>
        <Col xs={24} md={12}><Label>GSTIN (leave empty if unregistered)</Label><Input name="prGstin" value={p.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} maxLength={15} /></Col>
        <Col xs={24} md={12}>
          <Label>State</Label>
          {gstin.length >= 2 ? <Input name="prState" disabled value={`${gstin.slice(0, 2)} — ${getStateName(gstin.slice(0, 2)) || 'unknown'} (from the GSTIN)`} />
            : <Select name="prStateSel" showSearch optionFilterProp="label" style={{ width: '100%' }} value={p.stateCode} options={STATES} onChange={(v) => set({ stateCode: v })} />}
        </Col>
        <Col xs={24} md={16}><Label>Billing address</Label><Input name="prAddress" value={p.address} onChange={(e) => set({ address: e.target.value })} /></Col>
        <Col xs={12} md={4}><Label>City</Label><Input name="prCity" value={p.city} onChange={(e) => set({ city: e.target.value })} /></Col>
        <Col xs={12} md={4}><Label>Pincode</Label><Input name="prPin" value={p.pincode} maxLength={6} onChange={(e) => set({ pincode: e.target.value })} /></Col>
        <Col xs={24} md={8}><Label>Contact</Label><Input name="prContact" value={p.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} /></Col>
        <Col xs={12} md={8}><Label>Phone</Label><Input name="prPhone" value={p.phone} onChange={(e) => set({ phone: e.target.value })} /></Col>
        <Col xs={12} md={8}><Label>E-mail</Label><Input name="prEmail" value={p.email} onChange={(e) => set({ email: e.target.value })} /></Col>
        <Col xs={24} md={16}><Label>Their cutting waste</Label><Radio.Group value={p.wasteRule} options={toOptions(WASTE_RULE_LABEL)} onChange={(e) => set({ wasteRule: e.target.value })} /></Col>
        <Col xs={24} md={8}><Label>Weight tolerance on fabric</Label><InputNumber name="prTol" min={0} max={5} step={0.5} suffix="%" style={{ width: '100%' }} value={p.weightTolerancePct} onChange={(v) => set({ weightTolerancePct: v })} /></Col>
      </Row>
      {!gstin && <Alert type="warning" showIcon style={{ marginTop: 12 }} title="Unregistered: the concessional job-work GST rate may not apply — check the rate on their orders with your CA." />}
      {tried && errors.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={errors[0].message} />}
    </Drawer>
  );
};

export default PrincipalDrawer;
