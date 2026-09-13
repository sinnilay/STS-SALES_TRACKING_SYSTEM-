import api from './api';

export const profileService = {
  getMyProfile: async () => {
    const response = await api.get('/Profile/me');
    return response.data;
  },

  updateMyProfile: async (data) => {
    const response = await api.put('/Profile/me', data);
    return response.data;
  },

  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/Profile/me/picture', formData, {
      headers: { 'Content-Type': undefined },
    });
    return response.data;
  },
};
