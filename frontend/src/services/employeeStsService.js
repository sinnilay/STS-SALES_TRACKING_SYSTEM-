import api from './api';

export const employeeStsService = {
  getAssignedSales: async () => {
    const response = await api.get('/Employee/sales');
    return response.data;
  },

  updateSalesStatus: async (id, payload) => {
    const response = await api.put(`/Employee/sales/${id}/status`, payload);
    return response.data;
  },

  getSalesDataById: async (id) => {
    const response = await api.get(`/Employee/sales/${id}`);
    return response.data;
  },

  getSalesHistory: async (id) => {
    const response = await api.get(`/Employee/sales/${id}/history`);
    return response.data;
  },

  requestAllocation: async (id, comment) => {
    const response = await api.post(`/Employee/sales/${id}/request-allocation`, { comment });
    return response.data;
  },

  getStsReport: async () => {
    const response = await api.get('/Employee/sales/report');
    return response.data;
  },

  getCompanyEmployees: async () => {
    const response = await api.get('/Employee/employees');
    return response.data;
  },

  allocateToFieldSales: async (id, employeeId) => {
    const response = await api.put(`/Employee/sales/${id}/allocate`, { employeeId });
    return response.data;
  },

  scheduleMeeting: async (id, meetingMode) => {
    const response = await api.put(`/Employee/sales/${id}/schedule-meeting`, { meetingMode });
    return response.data;
  },

  getSiteImages: async (id) => {
    const response = await api.get(`/Employee/sales/${id}/site-images`);
    return response.data;
  },

  uploadSiteImage: async (id, file, uploadMethod) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadMethod', uploadMethod);
    const response = await api.post(`/Employee/sales/${id}/site-images`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },
};
