import { useMemo } from 'react';
import { Space } from 'antd';
import { ActionButton } from '../../../../components/buttons';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { SECTION_CONFIG } from '../model/sectionConfig';
import GridCell from './GridCell';
import SizesCell from './SizesCell';

const titleOf = (spec, currency) =>
  (spec.currency === 'costing' ? `${spec.title} (${getCurrencySymbol(currency)})` : spec.title);

/**
 * AntD columns for a section, from its config. The Sizes column appears only when the sheet has
 * more than one size — for a one-size costing it is noise.
 */
export default function useSectionColumns(sectionKey, { currency, showSizes, dispatch }) {
  return useMemo(() => {
    const config = SECTION_CONFIG[sectionKey];
    const cell = (spec) => (_, record) => <GridCell sectionKey={sectionKey} spec={spec} record={record} />;
    return [
      { title: 'S.No', key: 'sno', width: 50, align: 'center', render: (_, __, i) => i + 1 },
      showSizes && {
        title: 'Sizes', key: 'sizes', width: 150,
        render: (_, record) => <SizesCell sectionKey={sectionKey} record={record} />,
      },
      ...config.main.map((spec) => ({
        key: spec.field || spec.type,
        title: spec.type === 'master' ? config.master.title : titleOf(spec, currency),
        width: spec.width,
        align: spec.type === 'amount' ? 'right' : undefined,
        render: cell(spec),
      })),
      {
        key: 'actions', width: 76, align: 'center',
        render: (_, record) => (
          <Space size={0}>
            <ActionButton action="duplicate" onClick={() => dispatch({ type: 'DUPLICATE_ROW', section: sectionKey, key: record.key })} />
            <ActionButton action="delete" onClick={() => dispatch({ type: 'REMOVE_ROW', section: sectionKey, key: record.key })} />
          </Space>
        ),
      },
    ].filter(Boolean);
  }, [sectionKey, currency, showSizes, dispatch]);
}
