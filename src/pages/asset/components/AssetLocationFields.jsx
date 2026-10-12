import { Alert, Col, Form, Row, Select } from 'antd';

/**
 * Unit, department, section, line and custodian.
 *
 * Read-only once the asset exists: an asset moves through a transfer, which
 * records who moved it, when and why. Letting Edit change it would leave the
 * current location and the history disagreeing, and the server refuses it too.
 */
const AssetLocationFields = ({ lookups, unitId, departmentId, sectionId, employeeOptions, onEmployeeSearch, locked }) => (
  <>
    {locked && (
      <Alert
        type="info"
        showIcon
        title="Location is changed by a transfer, not by editing"
        description="Transfers record who moved the asset, when and why, and keep the movement history true."
        style={{ marginBottom: 16 }}
      />
    )}
    <Row gutter={16}>
      <Col xs={24} sm={12} md={8}>
        <Form.Item name="unitId" label="Unit" rules={[{ required: true, message: 'Pick the unit' }]}>
          <Select
            disabled={locked}
            showSearch
            optionFilterProp="label"
            placeholder="Select unit"
            options={lookups.options.units}
          />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Form.Item name="departmentId" label="Department" rules={[{ required: true, message: 'Pick the department' }]}>
          <Select
            disabled={locked || !unitId}
            showSearch
            optionFilterProp="label"
            placeholder={unitId ? 'Select department' : 'Pick a unit first'}
            options={lookups.departmentsOf(unitId)}
          />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Form.Item name="sectionId" label="Section" tooltip="Optional - set it up under Asset Setup">
          <Select
            disabled={locked || !departmentId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={departmentId ? 'Select section' : 'Pick a department first'}
            options={lookups.sectionsOf(departmentId)}
          />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Form.Item name="lineId" label="Line">
          <Select
            disabled={locked || !sectionId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={sectionId ? 'Select line' : 'Pick a section first'}
            options={lookups.linesOf(sectionId)}
          />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Form.Item
          name="custodianEmpId"
          label="Custodian"
          tooltip="Who answers for this asset. Not the same as issuing it to someone."
        >
          <Select
            allowClear
            showSearch
            filterOption={false}
            onSearch={onEmployeeSearch}
            placeholder="Search by name or employee no."
            options={employeeOptions}
            notFoundContent={null}
          />
        </Form.Item>
      </Col>
    </Row>
  </>
);

export default AssetLocationFields;
