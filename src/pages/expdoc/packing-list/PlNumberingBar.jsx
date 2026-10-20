import { useState } from 'react';
import {
  App, Button, InputNumber, Segmented, Space, Typography,
} from 'antd';
import { NUMBERING, NUMBERING_LABELS } from '../../../utils/expDocPlNumbering';
import { integerInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;

const OPTIONS = Object.values(NUMBERING).map((value) => ({ value, label: NUMBERING_LABELS[value] }));

/**
 * How this list numbers its cartons (owner, 2026-10-09): the buyer's rule, and where a
 * continuing series starts. Applied at once on a draft — the cartons renumber, and once
 * stickers were printed the user confirms first. Read-only text on a locked list.
 */
const PlNumberingBar = ({ pl, editable, busyKey, onApply }) => {
  const { modal } = App.useApp();
  const [first, setFirst] = useState(pl.firstCartonNo || 1);

  const apply = (patch) => {
    const go = () => onApply(patch);
    if (!pl.stickerRunCount) return go();
    return modal.confirm({
      title: 'Renumber cartons already printed?',
      content: 'Stickers were printed from this list. Renumbering marks those cartons for reprinting.',
      okText: 'Renumber',
      onOk: go,
    });
  };

  if (!editable) {
    return (
      <Text type="secondary">
        {`Carton numbers: ${NUMBERING_LABELS[pl.numbering] || NUMBERING_LABELS[NUMBERING.CONTINUE]}`}
        {pl.numbering === NUMBERING.CONTINUE && pl.firstCartonNo > 1 ? `, from ${pl.firstCartonNo}` : ''}
      </Text>
    );
  }
  return (
    <Space wrap size={12}>
      <Text strong>Carton numbers</Text>
      <Segmented
        name="pl-numbering"
        aria-label="Carton numbering"
        options={OPTIONS}
        value={pl.numbering}
        disabled={busyKey === 'numbering'}
        onChange={(numbering) => apply({ numbering })}
      />
      {pl.numbering === NUMBERING.CONTINUE && (
        <Space size={6}>
          <Text type="secondary"><label htmlFor="pl-first-carton">From carton</label></Text>
          <InputNumber
            {...integerInputProps}
            id="pl-first-carton"
            name="pl-first-carton"
            min={1}
            value={first}
            onChange={(v) => setFirst(v || 1)}
            style={{ width: 90 }}
          />
          {Number(first) !== Number(pl.firstCartonNo || 1) && (
            <Button size="small" loading={busyKey === 'numbering'} onClick={() => apply({ firstCartonNo: first })}>Apply</Button>
          )}
        </Space>
      )}
    </Space>
  );
};

export default PlNumberingBar;
