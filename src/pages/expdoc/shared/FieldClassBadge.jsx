import { Space, Tag, Tooltip, Typography } from 'antd';
import {
  LockOutlined, EditOutlined, CalculatorOutlined, SettingOutlined, FormOutlined,
} from '@ant-design/icons';
import { FIELD_CLASS, FIELD_CLASS_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

/**
 * The PRD §11.3 field classification, made visible.
 *
 * The requirement is not merely that fields behave differently — it is that a user
 * can SEE which is which before typing. A number pulled from an order and a number
 * somebody invented look identical on screen otherwise, and only one of them is
 * safe to trust.
 *
 * Each class reuses an idiom already in the app rather than inventing a fifth
 * visual language: the locked-cell treatment from the materials grid for Auto,
 * italic-muted for Calculated, a plain control for Manual.
 *
 * A field that is Auto AND read-only renders as `InvSteps.ReadCell` instead — the
 * italic value with a padlock. Same taxonomy, two presentations: a badge belongs
 * beside a control the user can act on, and would be noise beside one they cannot.
 */
const CLASS_META = {
  [FIELD_CLASS.AUTO]: {
    icon: <LockOutlined />,
    colour: 'default',
    hint: (source) => (source ? `Pulled from ${source}. Read-only here — correct it at the source.` : 'Pulled from the source record. Read-only here.'),
  },
  [FIELD_CLASS.AUTO_EDITABLE]: {
    icon: <EditOutlined />,
    colour: 'blue',
    hint: (source) => (source ? `Pulled from ${source}. You may override it; the change is warned and logged.` : 'Pulled automatically. You may override it; the change is warned and logged.'),
  },
  [FIELD_CLASS.MANUAL]: {
    icon: <FormOutlined />,
    colour: 'default',
    hint: () => 'Entered here. Nothing upstream supplies this.',
  },
  [FIELD_CLASS.CALCULATED]: {
    icon: <CalculatorOutlined />,
    colour: 'purple',
    hint: (source) => (source ? `Calculated from ${source}. Never entered directly.` : 'Calculated. Never entered directly.'),
  },
  [FIELD_CLASS.CONFIG]: {
    icon: <SettingOutlined />,
    colour: 'gold',
    hint: (source) => (source ? `Set by ${source}.` : "Set by the buyer's template."),
  },
};

/**
 * The badge itself. `modified` is the §11.3 "auto-editable that was overridden"
 * marker — the one state a reader most needs, because the value no longer matches
 * what the source says.
 */
const FieldClassBadge = ({ fieldClass, source, modified, originalValue }) => {
  const meta = CLASS_META[fieldClass];
  if (!meta) return null;

  const label = FIELD_CLASS_LABELS[fieldClass];

  return (
    <Space size={4} style={{ marginInlineStart: 6 }}>
      <Tooltip title={meta.hint(source)}>
        <Tag
          color={meta.colour}
          icon={meta.icon}
          style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', cursor: 'help' }}
        >
          {label}
        </Tag>
      </Tooltip>
      {modified && (
        <Tooltip title={originalValue != null && originalValue !== ''
          ? `Overridden. The source says: ${originalValue}`
          : 'Overridden — this no longer matches the source.'}
        >
          <Tag color="warning" style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px', cursor: 'help' }}>
            Modified
          </Tag>
        </Tooltip>
      )}
    </Space>
  );
};

/**
 * A form label carrying its classification — the shape most callers want, since a
 * badge floating without a label is meaningless.
 */
export const ClassifiedLabel = ({ children, fieldClass, source, modified, originalValue }) => (
  <span>
    <Text>{children}</Text>
    <FieldClassBadge
      fieldClass={fieldClass}
      source={source}
      modified={modified}
      originalValue={originalValue}
    />
  </span>
);

export default FieldClassBadge;
