import apiClient from './api/client';

export async function submitFeedback({ category, message, contactEmail, contactPhone, attachment }) {
  const formData = new FormData();
  formData.append('category', category || '');
  formData.append('message', message || '');
  if (contactEmail) formData.append('contactEmail', contactEmail);
  if (contactPhone) formData.append('contactPhone', contactPhone);
  if (attachment) formData.append('attachment', attachment);

  const response = await apiClient.post('/feedback', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data;
}
