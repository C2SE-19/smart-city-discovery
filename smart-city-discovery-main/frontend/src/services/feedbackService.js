import apiClient from './api/client';

export async function fetchFeedbackTypes() {
  const response = await apiClient.get('/feedback/types');
  return response.data;
}

export async function submitFeedback({
  feedbackTypeId,
  category,
  message,
  contactEmail,
  contactPhone,
  attachment,
}) {
  const formData = new FormData();
  if (feedbackTypeId !== undefined && feedbackTypeId !== null && feedbackTypeId !== '') {
    formData.append('feedbackTypeId', String(feedbackTypeId));
  }
  if (category) {
    formData.append('category', String(category));
  }
  formData.append('message', message || '');
  if (contactEmail) formData.append('contactEmail', contactEmail);
  if (contactPhone) formData.append('contactPhone', contactPhone);
  if (attachment) formData.append('attachment', attachment);

  const response = await apiClient.post('/feedback', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data;
}
