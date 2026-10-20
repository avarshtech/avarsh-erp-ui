import { Alert, Flex, Tag, Typography } from 'antd';
import { attributeKey } from './itemGuess';

const { Text } = Typography;
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
// A stored key with no attribute behind it (an older variant): "fabricWidth" → "Fabric Width".
const keyLabel = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/**
 * The item already saved for the chosen classifiers, with each of its variants in full — name,
 * code and attribute values — so the user sees what exists before adding another. When the name
 * being typed is already one of them, the existing variant is used rather than a copy created.
 */
export default function ExistingVariants({ item, attributes, variantName }) {
  const labels = Object.fromEntries((attributes || []).map((a) => [attributeKey(a.attributeName), a.attributeName]));
  const variants = (item.variants || []).filter((v) => v.isActive !== false);
  const same = variants.find((v) => norm(v.variantName) === norm(variantName));

  return (
    <Alert
      type="success" showIcon style={{ marginBottom: 16 }}
      title={`${item.itemCode} already exists — this adds a variant to it`}
      description={(
        <Flex vertical gap={6}>
          {same && <Text type="warning">“{same.variantName}” is already one of its variants ({same.variantCode}) — it will be used as it is.</Text>}
          {variants.length === 0 ? <Text type="secondary">It has no active variants yet.</Text> : (
            <>
              <Text type="secondary" style={{ fontSize: 12 }}>Its {variants.length} variant{variants.length === 1 ? '' : 's'}:</Text>
              <Flex vertical gap={6} style={{ maxHeight: 200, overflowY: 'auto' }} role="list" aria-label={`Variants of ${item.itemCode}`}>
                {variants.map((v) => (
                  <div key={v.id} role="listitem">
                    <Text strong>{v.variantName}</Text> <Text type="secondary" style={{ fontSize: 12 }}>{v.variantCode}</Text>
                    <div>
                      {Object.entries(v.attributes || {}).filter(([, value]) => value !== '' && value != null).map(([k, value]) => (
                        <Tag key={k} style={{ marginTop: 2 }}>{labels[k] || keyLabel(k)}: {String(value)}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </Flex>
            </>
          )}
        </Flex>
      )}
    />
  );
}
