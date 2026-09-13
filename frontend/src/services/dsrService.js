import api from './api';

export const dsrService = {
  getDsrEntries: async ({ date, dateFrom, dateTo, employeeId, search } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (employeeId) params.append('employeeId', employeeId);
    if (search) params.append('search', search);

    const query = params.toString();
    const response = await api.get(`/Admin/dsr${query ? `?${query}` : ''}`);
    return response.data;
  },

  getMyDsrEntries: async ({ date, dateFrom, dateTo, search } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (search) params.append('search', search);

    const query = params.toString();
    const response = await api.get(`/Employee/my-dsr${query ? `?${query}` : ''}`);
    return response.data;
  },
};
