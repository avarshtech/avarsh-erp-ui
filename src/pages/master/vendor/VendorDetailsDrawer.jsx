import { useEffect, useState } from 'react';
import { Descriptions, Divider, Drawer, Space, Spin, Tag, Typography } from 'antd';
import { BankOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import StatusBadge from '../../../components/StatusBadge';
import { getVendor } from '../../../services/master/vendorService';
import VendorApprovalDetails from './VendorApprovalDetails';

const { Title, Text } = Typography;
const LABEL = { label: { width: 140 } };
const dash = (v) => v || '-';
const when = (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-');

/** One vendor in full. The PAN and bank details are read only when the drawer opens (the list has none). */
const VendorDetailsDrawer = ({ vendor, open, onClose, onEdit, canUpdate, nameOf }) => {
  // The detail is kept with the row it was read for: another vendor's never shows while this one
  // loads, and a saved edit (which replaces the row) never shows the PAN and bank details from before
  const [loaded, setLoaded] = useState({ row: null, data: null });

  useEffect(() => {
    if (!open || !vendor?.id) return undefined;
    let alive = true;
    getVendor(vendor.id)
      .then((res) => { if (alive) setLoaded({ row: vendor, data: res?.data ?? res }); })
      .catch(() => { /* the interceptor has shown the error */ });
    return () => { alive = false; };
  }, [open, vendor]);

  const detail = vendor && loaded.row === vendor ? loaded.data : null;
  const v = detail || vendor;
  return (
    <Drawer
      title={<Space><EyeOutlined /><span>Vendor Details</span></Space>}
      placement="right"
      size={560}
      open={open}
      onClose={onClose}
      extra={canUpdate && vendor ? <ActionButton action="edit" text="Edit" onClick={() => onEdit(vendor)} /> : null}
    >
      {v && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Title level={4} style={{ margin: 0 }}>{v.name}</Title>
            <StatusBadge status={v.active !== false ? 'active' : 'inactive'} />
          </div>

          <Divider titlePlacement="start">Contact &amp; Address</Divider>
          <Descriptions column={1} size="small" styles={LABEL} items={[
            { key: 'contactPerson', label: 'Contact Person', children: dash(v.contactPerson) },
            { key: 'phone', label: 'Phone', children: dash(v.phone) },
            { key: 'email', label: 'Email', children: dash(v.email) },
            { key: 'address', label: 'Address', children: dash(v.address) },
            { key: 'place', label: 'City / State', children: dash([v.city, v.state, v.pincode].filter(Boolean).join(', ')) },
          ]} />

          <VendorApprovalDetails vendor={v} nameOf={nameOf} />

          <Divider titlePlacement="start">Tax &amp; Terms</Divider>
          <Descriptions column={1} size="small" styles={LABEL} items={[
            { key: 'gstin', label: 'GSTIN', children: v.gstin || <Text type="secondary">Unregistered</Text> },
            { key: 'pan', label: 'PAN', children: detail ? dash(detail.pan) : <Spin size="small" /> },
            { key: 'igst', label: 'IGST Applicable', children: <Tag color={v.igstApplicable ? 'blue' : 'default'}>{v.igstApplicable ? 'Yes' : 'No'}</Tag> },
            { key: 'terms', label: 'Payment Terms', children: dash(v.paymentTerms) },
          ]} />

          <Divider titlePlacement="start"><BankOutlined style={{ marginRight: 6 }} />Bank Details</Divider>
          {!detail ? <Spin size="small" /> : (
            <Descriptions column={1} size="small" styles={LABEL} items={[
              { key: 'bankName', label: 'Bank Name', children: dash(detail.bankName) },
              { key: 'account', label: 'Account Number', children: dash(detail.bankAccountNumber) },
              { key: 'branch', label: 'Branch', children: dash(detail.bankBranch) },
              { key: 'ifsc', label: 'IFSC Code', children: dash(detail.ifscCode) },
              { key: 'swift', label: 'SWIFT Code', children: dash(detail.swiftCode) },
            ]} />
          )}

          <Divider titlePlacement="start">Metadata</Divider>
          <Descriptions column={1} size="small" styles={LABEL} items={[
            { key: 'id', label: 'Vendor ID', children: v.id },
            { key: 'created', label: 'Created', children: when(v.createdAt) },
            { key: 'updated', label: 'Updated', children: when(v.updatedAt) },
          ]} />
        </>
      )}
    </Drawer>
  );
};

export default VendorDetailsDrawer;
