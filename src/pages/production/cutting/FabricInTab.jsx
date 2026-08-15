import { useState } from 'react';
import { Segmented } from 'antd';
import FabricReceiptList from './FabricReceiptList';
import FabricRelaxationList from './FabricRelaxationList';

/** FR-01 + FR-02 — fabric arrival at the cutting floor and mandatory relaxation. */
const FabricInTab = () => {
  const [view, setView] = useState('Fabric Receipt');
  return (
    <div>
      <Segmented
        options={['Fabric Receipt', 'Fabric Relaxation']}
        value={view}
        onChange={setView}
        style={{ marginBottom: 16 }}
      />
      {view === 'Fabric Receipt' ? <FabricReceiptList /> : <FabricRelaxationList />}
    </div>
  );
};

export default FabricInTab;
