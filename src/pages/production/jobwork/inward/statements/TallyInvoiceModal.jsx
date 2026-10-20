import { useState } from 'react';
import {
  Alert, App, DatePicker, Input, Modal, Space,
} from 'antd';
import dayjs from 'dayjs';
import { recordTallyInvoice } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../../utils/uiConstants';
import { fmtMoney } from '../../jwFormat';

/** The accountant raised one Tally invoice for the selected returns; record its number against them. */
const TallyInvoiceModal = ({ rows, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [busy, setBusy] = useState(false);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const ok = async () => {
    setBusy(true);
    try {
      await recordTallyInvoice({ returnIds: rows.map((r) => r.returnId), invoiceNo, invoiceDate });
      message.success(`Tally invoice ${invoiceNo} recorded against ${rows.length} return(s).`);
      onSaved();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  return (
    <Modal open destroyOnHidden title="Record the Tally invoice" okText="Record" okButtonProps={{ loading: busy, disabled: !invoiceNo.trim() }} onOk={ok} onCancel={onClose}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Alert type="info" showIcon title={`${rows.length} return(s) of ${rows[0]?.principalName} — ${fmtMoney(total)}`}
          description={rows.map((r) => r.returnNo).join(', ')} />
        <Input name="tallyNo" placeholder="Tally invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        <DatePicker name="tallyDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(invoiceDate)} disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setInvoiceDate(d.format('YYYY-MM-DD'))} />
      </Space>
    </Modal>
  );
};

export default TallyInvoiceModal;
