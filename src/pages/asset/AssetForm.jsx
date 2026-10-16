import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Card, Divider, Form, Space, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import useAssetLookups from '../../hooks/useAssetLookups';
import { toastUnlessHandled } from '../../utils/apiError';
import {
  createAsset, getAsset, getEmployeeOptions, updateAsset,
} from '../../services/asset/assetService';
import AssetIdentityFields from './components/AssetIdentityFields';
import AssetLocationFields from './components/AssetLocationFields';
import AssetPurchaseFields from './components/AssetPurchaseFields';
import AssetSpecFields from './components/AssetSpecFields';
import { toFormValues, toPayload } from './assetFormPayload';

const NEW_DEFAULTS = { status: 'ACTIVE', condition: 'NEW', amcAvailable: false, specData: {} };

/**
 * Add or correct an asset.
 *
 * On an edit the location and the category are read-only: the location moves
 * only through a transfer, and the category is baked into the asset ID that is
 * already stuck on the machine. The server enforces both; this just does not
 * offer them.
 */
const AssetForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const lookups = useAssetLookups();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [asset, setAsset] = useState(null);
  const [employees, setEmployees] = useState([]);

  const isEdit = !!id;
  const categoryId = Form.useWatch('categoryId', form);
  const subCategoryId = Form.useWatch('subCategoryId', form);
  const unitId = Form.useWatch('unitId', form);
  const departmentId = Form.useWatch('departmentId', form);
  const sectionId = Form.useWatch('sectionId', form);
  const amcAvailable = Form.useWatch('amcAvailable', form);

  // Named individually rather than through `lookups`, so these do not rebuild
  // whenever anything else on the hook changes - and so a future regression in
  // the hook's own memoisation cannot restart the render loop this screen hit.
  const { loading: lookupsLoading, subCategoriesOf, fieldDefsFor } = lookups;
  const subCategoryOptions = useMemo(
    () => subCategoriesOf(categoryId),
    [subCategoriesOf, categoryId],
  );
  const fieldDefs = useMemo(
    () => fieldDefsFor(categoryId, subCategoryId),
    [fieldDefsFor, categoryId, subCategoryId],
  );

  const searchEmployees = useCallback(async (search) => {
    try {
      setEmployees(await getEmployeeOptions(search));
    } catch {
      // A failed custodian search is not worth a toast - the field is optional.
      setEmployees([]);
    }
  }, []);

  useEffect(() => { searchEmployees(''); }, [searchEmployees]);

  // The asset is loaded once the definitions are known, so a DATE spec field
  // can be turned into a dayjs value rather than arriving as a bare string.
  useEffect(() => {
    if (!id || lookupsLoading) return;
    setLoading(true);
    getAsset(id)
      .then((loaded) => {
        setAsset(loaded);
        const defs = fieldDefsFor(loaded.categoryId, loaded.subCategoryId);
        form.setFieldsValue(toFormValues(loaded, defs));
        if (loaded.custodianEmpId) {
          setEmployees((current) => (current.some((o) => o.id === loaded.custodianEmpId) ? current
            : [{ id: loaded.custodianEmpId, label: loaded.custodianName }, ...current]));
        }
      })
      .catch((e) => toastUnlessHandled(message, e, 'Could not load the asset'))
      .finally(() => setLoading(false));
  }, [id, lookupsLoading, fieldDefsFor, form, message]);

  // Changing a parent clears what hung off it, so a stale child cannot be saved.
  // Only on a real change: the first value a watch reports is the one the loaded
  // asset just put there, and clearing on that would drop its sub-category.
  const previous = useRef({});
  useEffect(() => {
    if (previous.current.categoryId !== undefined && previous.current.categoryId !== categoryId) {
      form.setFieldValue('subCategoryId', undefined);
    }
    previous.current.categoryId = categoryId;
  }, [categoryId, form]);
  useEffect(() => {
    if (previous.current.departmentId !== undefined && previous.current.departmentId !== departmentId) {
      form.setFieldsValue({ sectionId: undefined, lineId: undefined });
    }
    previous.current.departmentId = departmentId;
  }, [departmentId, form]);
  useEffect(() => {
    if (previous.current.sectionId !== undefined && previous.current.sectionId !== sectionId) {
      form.setFieldValue('lineId', undefined);
    }
    previous.current.sectionId = sectionId;
  }, [sectionId, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      const payload = toPayload(values, asset?.version);
      const saved = isEdit ? await updateAsset(id, payload) : await createAsset(payload);
      message.success(isEdit ? 'Asset updated' : `Asset ${saved.assetId} added`);
      navigate(`/assets/${saved.id}`);
    } catch (e) {
      toastUnlessHandled(message, e, isEdit ? 'Could not update the asset' : 'Could not add the asset');
    } finally {
      setSaving(false);
    }
  };

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: e.label })),
    [employees],
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Edit ${asset?.assetId ?? 'asset'}` : 'Add Asset'}
        subtitle={isEdit
          ? 'Corrects the asset’s details. Its ID and location do not change here.'
          : 'The asset ID is generated from the category and the unit once you save.'}
        onBack={() => navigate(isEdit ? `/assets/${id}` : '/assets')}
      />

      <Spin spinning={loading || lookups.loading}>
        <Form form={form} layout="vertical" initialValues={NEW_DEFAULTS} onFinish={submit}>
          <Card title="What it is">
            <AssetIdentityFields
              categoryOptions={lookups.options.categories}
              subCategoryOptions={subCategoryOptions}
              categoryLocked={isEdit}
            />
            {fieldDefs.length > 0 && (
              <>
                <Divider titlePlacement="start">Category details</Divider>
                <AssetSpecFields defs={fieldDefs} />
              </>
            )}
          </Card>

          <Card title="Where it is" style={{ marginTop: 16 }}>
            <AssetLocationFields
              lookups={lookups}
              unitId={unitId}
              departmentId={departmentId}
              sectionId={sectionId}
              employeeOptions={employeeOptions}
              onEmployeeSearch={searchEmployees}
              locked={isEdit}
            />
          </Card>

          <Card title="Purchase, warranty and AMC" style={{ marginTop: 16 }}>
            <AssetPurchaseFields supplierOptions={lookups.options.suppliers} amcAvailable={amcAvailable} />
          </Card>

          <Space style={{ marginTop: 16 }}>
            <ActionButton action="save" text={isEdit ? 'Save changes' : 'Add asset'} loading={saving} htmlType="submit" />
            <ActionButton action="cancel" onClick={() => navigate(isEdit ? `/assets/${id}` : '/assets')} />
          </Space>
        </Form>
      </Spin>
    </div>
  );
};

export default AssetForm;
