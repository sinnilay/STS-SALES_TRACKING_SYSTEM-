import api from './api';

export const settingsService = {
  getDepartments: async () => {
    const response = await api.get('/settings/departments');
    return response.data;
  },
  
  addDepartment: async (name) => {
    const response = await api.post('/settings/departments', { name });
    return response.data;
  },

  getDesignations: async () => {
    const response = await api.get('/settings/designations');
    return response.data;
  },

  addDesignation: async (name) => {
    const response = await api.post('/settings/designations', { name });
    return response.data;
  },

  getEmployeeRoles: async () => {
    const response = await api.get('/Settings/employee-roles');
    return response.data;
  },

  addEmployeeRole: async (name) => {
    const response = await api.post('/Settings/employee-roles', { name });
    return response.data;
  },

  getMyCompany: async () => {
    const response = await api.get('/Admin/my-company');
    return response.data;
  },

  uploadCompanyLogo: async (formData) => {
    const response = await api.post('/Admin/company-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeCompanyLogo: async () => {
    const response = await api.delete('/Admin/company-logo');
    return response.data;
  },
};
