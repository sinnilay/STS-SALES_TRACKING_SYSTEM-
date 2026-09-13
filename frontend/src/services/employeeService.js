import api from './api';

export const employeeService = {
  getAllEmployees: async () => {
    const response = await api.get('/Admin/employees');
    return response.data;
  },

  getEmployeeById: async (id) => {
    const response = await api.get(`/Admin/employees/${id}`);
    return response.data;
  },

  addEmployee: async (employeeData) => {
    const response = await api.post('/Admin/employees', employeeData);
    return response.data;
  },

  updateEmployee: async (id, employeeData) => {
    const response = await api.put(`/Admin/employees/${id}`, employeeData);
    return response.data;
  },

  resetPassword: async (id, newPassword) => {
    const response = await api.put(`/Admin/employees/${id}/reset-password`, { newPassword });
    return response.data;
  },

  updatePermissions: async (id, permissions) => {
    const response = await api.put(`/Admin/employees/${id}/permissions`, { permissions });
    return response.data;
  },

  toggleEmployeeStatus: async (id) => {
    const response = await api.put(`/Admin/employees/${id}/toggle-status`);
    return response.data;
  },

  uploadEmployeePicture: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/Admin/employees/${id}/picture`, formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },

  getEmployeeMeetings: async (id) => {
    const response = await api.get(`/Admin/employees/${id}/meetings`);
    return response.data;
  },
};
