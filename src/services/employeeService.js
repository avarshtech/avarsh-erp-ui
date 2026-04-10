import axiosInstance from './axiosInstance';

const BASE_URL = '/hr/employees';

/**
 * Search employees with filters and pagination.
 * GET /api/v1/hr/employees/search
 */
export const searchEmployees = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.append('search', params.search);
  if (params.departmentId) queryParams.append('departmentId', params.departmentId);
  if (params.factoryId) queryParams.append('factoryId', params.factoryId);
  if (params.status) queryParams.append('status', params.status);
  if (params.category) queryParams.append('category', params.category);
  if (params.employeeType) queryParams.append('employeeType', params.employeeType);
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) queryParams.append('sort', params.sort);
  if (params.direction) queryParams.append('direction', params.direction);

  const queryString = queryParams.toString();
  const url = `${BASE_URL}/search${queryString ? `?${queryString}` : ''}`;
  const response = await axiosInstance.get(url);
  const data = response.data;

  // Normalize pagination fields for frontend compatibility
  return {
    content: data.content || [],
    totalElements: data.totalElements || 0,
    totalPages: data.totalPages || 0,
    size: data.pageSize ?? data.size ?? 25,
    number: data.pageNumber ?? data.number ?? 0,
    last: data.last,
  };
};

/**
 * Get a single employee by ID.
 * GET /api/v1/hr/employees/{id}
 */
export const getEmployeeById = async (id) => {
  const response = await axiosInstance.get(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Create a new employee.
 * POST /api/v1/hr/employees
 */
export const createEmployee = async (data) => {
  const response = await axiosInstance.post(BASE_URL, data);
  return response.data;
};

/**
 * Update an existing employee.
 * PUT /api/v1/hr/employees/{id}
 */
export const updateEmployee = async (id, data) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}`, { id: Number(id), ...data });
  return response.data;
};

/**
 * Change employee status (ACTIVE, INACTIVE, TERMINATED, etc.).
 * PUT /api/v1/hr/employees/{id}/status?status=X
 */
export const changeEmployeeStatus = async (id, status) => {
  const response = await axiosInstance.put(`${BASE_URL}/${id}/status`, null, {
    params: { status },
  });
  return response.data;
};
