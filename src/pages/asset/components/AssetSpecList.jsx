import { Descriptions, Divider } from 'antd';

const parse = (json, fallback) => {
  try { return JSON.parse(json || fallback); } catch { return JSON.parse(fallback); }
};

/**
 * The category's own fields, labelled as the category defines them.
 *
 * Driven by the definitions, not by the stored keys, so a field renamed in
 * Setup reads by its new label and a field removed from the category stops
 * showing without anything having to clean the stored values.
 */
const AssetSpecList = ({ specData, fieldDefs }) => {
  const values = parse(specData, '{}');
  const defs = parse(fieldDefs, '[]').filter((def) => values[def.key] !== undefined && values[def.key] !== null);

  if (!defs.length) return null;

  return (
    <>
      <Divider titlePlacement="start">Category details</Divider>
      <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
        {defs.map((def) => (
          <Descriptions.Item key={def.key} label={def.label}>{String(values[def.key])}</Descriptions.Item>
        ))}
      </Descriptions>
    </>
  );
};

export default AssetSpecList;
