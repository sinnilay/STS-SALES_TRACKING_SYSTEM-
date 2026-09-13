import api from './api';

export const stsService = {
  getAllSales: async () => {
    const response = await api.get('/Admin/sales');
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

  bulkDeallocateSalesData: async ({ salesIds, reason }) => {
    const response = await api.put('/Admin/sales/bulk-deallocate', { salesIds, reason });
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
