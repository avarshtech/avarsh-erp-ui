import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Form, Spin } from 'antd';
import { findOrCreateItem } from '../../../services/master/quickItemService';
import ClassifierFields from './ClassifierFields';
import UomFields from './UomFields';
import VariantAttributeFields from './VariantAttributeFields';
import QuickFormFooter from './QuickFormFooter';
import useItemMeta from './useItemMeta';
import useExistingItem from './useExistingItem';
import ExistingVariants from './ExistingVariants';
import { NEW, attributeKey, guessAttributes, guessClassifiers } from './itemGuess';

/**
 * A missing fabric or trim, created without leaving the sheet. prefill: { text, category, proposal? }
 * — proposal is an AI draft's ProposedItemDTO, whose classifiers and attribute values win over guesses.
 * The category is the one the costing section draws from; the item type and attribute values
 * are guessed from what was typed and shown for confirmation. The server finds or creates:
 * an existing item gets a new variant, an existing variant is simply returned.
 */
export default function ItemVariantQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const meta = useItemMeta();
  const [saving, setSaving] = useState(false);
  const categoryId = Form.useWatch('categoryId', form);
  const subCategoryId = Form.useWatch('subCategoryId', form);
  const itemTypeId = Form.useWatch('itemTypeId', form);
  const newSubName = Form.useWatch('newSubCategoryName', form);
  const newTypeName = Form.useWatch('newItemTypeName', form);
  const newTypeAttributeIds = Form.useWatch('newTypeAttributeIds', form);
  const variantName = Form.useWatch('variantName', form);

  const category = meta.categories.find((c) => c.id === categoryId);
  const isNewSub = subCategoryId === NEW;
  const isNewType = itemTypeId === NEW;
  const sub = isNewSub ? null : category?.subCategories?.find((s) => s.id === subCategoryId);
  const type = isNewType ? null : sub?.itemTypes?.find((t) => t.id === itemTypeId);
  const attributes = useMemo(
    () => (isNewType ? meta.attributes.filter((a) => (newTypeAttributeIds || []).includes(a.id)) : type?.attributes || []),
    [isNewType, meta.attributes, newTypeAttributeIds, type],
  );
  const typeUoms = type?.uoms?.length ? type.uoms : meta.uoms;
  const { existing, sibling } = useExistingItem(categoryId, subCategoryId, itemTypeId);

  useEffect(() => {
    const cat = meta.categories.find((c) => c.name?.toLowerCase() === String(prefill.category || '').toLowerCase());
    if (!cat) return;
    // An AI proposal names its classifiers outright — existing ones, or new ones to create with the
    // material; otherwise guess them from the typed words.
    const p = prefill.proposal;
    if (p && (p.subCategoryId || p.newSubCategoryName)) {
      const newType = !p.itemTypeId && p.newItemTypeName;
      form.setFieldsValue({
        categoryId: cat.id,
        subCategoryId: p.subCategoryId ?? NEW,
        newSubCategoryName: p.subCategoryId ? undefined : p.newSubCategoryName,
        itemTypeId: p.itemTypeId ?? (newType ? NEW : undefined),
        newItemTypeName: newType || undefined,
        ...(newType ? { newTypeAttributeIds: p.newItemTypeAttributeIds || [] } : {}),
        ...(p.uomId ? { uomId: p.uomId } : {}),
      });
      return;
    }
    const guess = guessClassifiers(cat, prefill.text);
    form.setFieldsValue({ categoryId: cat.id, subCategoryId: guess?.sub?.id, itemTypeId: guess?.type?.id ?? undefined });
  }, [meta.categories, prefill.category, prefill.text, prefill.proposal, form]);

  useEffect(() => {
    const stated = Object.fromEntries(attributes
      .map((a) => [a.id, prefill.proposal?.attributes?.[attributeKey(a.attributeName)]])
      .filter(([, value]) => value));
    const filled = Object.entries({ ...guessAttributes(attributes, prefill.text), ...stated })
      .filter(([id]) => !form.getFieldValue(`attr_${id}`))
      .map(([id, value]) => [`attr_${id}`, value]);
    if (filled.length) form.setFieldsValue(Object.fromEntries(filled));
  }, [attributes, prefill.text, prefill.proposal, form]);

  useEffect(() => {
    if (existing) {
      form.setFieldsValue({
        uomId: existing.uomId, splitUnit: !!existing.uomConversionFactor, secondaryUomId: existing.secondaryUomId,
        uomConversionFactor: existing.uomConversionFactor, hsnCode: existing.hsnCode, defaultAllowance: existing.defaultAllowance,
      });
    } else if (sibling) {
      form.setFieldsValue({
        hsnCode: form.getFieldValue('hsnCode') || sibling.hsnCode,
        defaultAllowance: form.getFieldValue('defaultAllowance') || sibling.defaultAllowance || 0,
      });
    }
    if (!existing && type?.uoms?.length === 1 && !form.getFieldValue('uomId')) form.setFieldValue('uomId', type.uoms[0].id);
  }, [existing, sibling, type, form]);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const result = await findOrCreateItem({
        clientRef: 'sheet',
        categoryId: values.categoryId,
        subCategoryId: isNewSub ? null : values.subCategoryId,
        newSubCategoryName: isNewSub ? values.newSubCategoryName : null,
        itemTypeId: isNewType ? null : values.itemTypeId,
        newItemType: isNewType ? { name: values.newItemTypeName, attributeIds: values.newTypeAttributeIds || [], uomIds: [] } : null,
        uomId: values.uomId,
        secondaryUomId: values.splitUnit ? values.secondaryUomId : null,
        uomConversionFactor: values.splitUnit ? values.uomConversionFactor : null,
        hsnCode: values.hsnCode || null,
        defaultAllowance: values.defaultAllowance ?? 0,
        variant: {
          variantName: values.variantName.trim(),
          attributes: Object.fromEntries(attributes.map((a) => [attributeKey(a.attributeName), String(values[`attr_${a.id}`] ?? '').trim()])),
        },
      });
      const { variant } = result;
      if (!result.variantCreated) message.info(`${variant.variantName} already exists — using it`);
      else message.success(result.itemCreated ? `Created ${variant.variantName} (${variant.variantCode})` : `Added ${variant.variantName} to ${variant.itemCode}`);
      onDone(variant, result);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={meta.loading}>
      <Form form={form} name="quickItem" layout="vertical" onFinish={handleFinish} initialValues={{ variantName: prefill.text, defaultAllowance: 0 }}>
        {prefill.text && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title={`Creating "${prefill.text}"`}
            description="The fields below are guessed from what you typed. Check them, then create." />
        )}
        <ClassifierFields form={form} categories={meta.categories} category={category} sub={sub}
          isNewSub={isNewSub} isNewType={isNewType} newSubName={newSubName} newTypeName={newTypeName} />
        {existing && <ExistingVariants item={existing} attributes={attributes} variantName={variantName} />}
        <UomFields form={form} allUoms={meta.uoms} locked={!!existing}
          uomOptions={typeUoms.map((u) => ({ value: u.id, label: u.symbol || u.name }))} />
        <VariantAttributeFields attributes={attributes} isNewType={isNewType} allAttributes={meta.attributes} />
        <QuickFormFooter saving={saving} onCancel={onCancel} okText={existing ? 'Add variant' : 'Create material'} />
      </Form>
    </Spin>
  );
}
