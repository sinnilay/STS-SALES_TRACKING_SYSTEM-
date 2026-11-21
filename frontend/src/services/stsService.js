import api from './api';

export const stsService = {
  // Server-side filtered + paged list: { items, total, grandTotal, page, pageSize }.
  // Pass { all: true } to get every match (CSV export).
  querySales: async (params) => {
    const response = await api.post('/Admin/sales/query', params);
    return response.data;
  },

  getSalesStats: async () => {
    const response = await api.get('/Admin/sales/stats');
    return response.data;
  },

  // Slim rows for the bulk Assign / De-Assign pickers. Omit `allocated` to get every record.
  getSalesLite: async (allocated) => {
    const query = allocated === undefined ? '' : `?allocated=${allocated}`;
    const response = await api.get(`/Admin/sales/lite${query}`);
    return response.data;
  },

  getSalesDataById: async (id) => {
    const response = await api.get(`/Admin/sales/${id}`);
    return response.data;
  },

  getSalesHistory: async (id) => {
    const response = await api.get(`/Admin/sales/${id}/history`);
    return response.data;
  },

  addSalesData: async (salesData) => {
    const response = await api.post('/Admin/sales', salesData);
    return response.data;
  },

  addSalesDataAsEmployee: async (salesData) => {
    const response = await api.post('/Employee/sales', salesData);
    return response.data;
  },

  importSalesData: async (records) => {
    const response = await api.post('/Admin/sales/bulk', records);
    return response.data;
  },

  searchSalesData: async (searchBy, query) => {
    const response = await api.get(`/Admin/sales/search?searchBy=${searchBy}&query=${encodeURIComponent(query)}`);
    return response.data;
  },

  searchSalesDataAsEmployee: async (searchBy, query) => {
    const response = await api.get(`/Employee/sales/search?searchBy=${searchBy}&query=${encodeURIComponent(query)}`);
    return response.data;
  },

  allocateSalesData: async (id, employeeId) => {
    const response = await api.put(`/Admin/sales/${id}/allocate`, { employeeId });
    return response.data;
  },

  updateSalesData: async (id, salesData) => {
    const response = await api.put(`/Admin/sales/${id}`, salesData);
    return response.data;
  },

  deleteSalesData: async (id) => {
    const response = await api.delete(`/Admin/sales/${id}`);
    return response.data;
  },

  bulkAllocateSalesData: async ({ employeeId, salesIds, allocatorComment }) => {
    const response = await api.put('/Admin/sales/bulk-allocate', { employeeId, salesIds, allocatorComment });
    return response.data;
  },

  // employeeIds: only take these people off the records (others keep them); omit to clear all holders.
  bulkDeallocateSalesData: async ({ salesIds, reason, employeeIds }) => {
    const response = await api.put('/Admin/sales/bulk-deallocate', { salesIds, reason, employeeIds });
    return response.data;
  },

  updateSalesStatus: async (id, payload) => {
    const response = await api.put(`/Admin/sales/${id}/status`, payload);
    return response.data;
  },

  getAllSiteImages: async () => {
    const response = await api.get('/Admin/site-images');
    return response.data;
  },

  getStsRequests: async (status = 'Pending') => {
    const response = await api.get(`/Admin/sts-requests?status=${encodeURIComponent(status)}`);
    return response.data;
  },

  approveStsRequest: async (id) => {
    const response = await api.put(`/Admin/sts-requests/${id}/approve`);
    return response.data;
  },

  rejectStsRequest: async (id, comment) => {
    const response = await api.put(`/Admin/sts-requests/${id}/reject`, { comment });
    return response.data;
  },
};
