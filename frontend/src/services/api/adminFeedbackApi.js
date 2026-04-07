import apiClient from './client';

export async function fetchAdminFeedbackTypes() {
  const response = await apiClient.get('/admin/feedback/types');
  return response.data;
}

export async function createAdminFeedbackType(payload) {
  const response = await apiClient.post('/admin/feedback/types', payload);
  return response.data;
}

export async function updateAdminFeedbackType(typeId, payload) {
  const response = await apiClient.patch(`/admin/feedback/types/${typeId}`, payload);
  return response.data;
}

export async function deleteAdminFeedbackType(typeId) {
  const response = await apiClient.delete(`/admin/feedback/types/${typeId}`);
  return response.data;
}

export async function fetchAdminFeedbackReports(params = {}) {
  const response = await apiClient.get('/admin/feedback/reports', {
    params,
  });

  return response.data;
}

export async function fetchAdminFeedbackReportDetail(feedbackId) {
  const response = await apiClient.get(`/admin/feedback/reports/${feedbackId}`);
  return response.data;
}

export async function checkAdminFeedbackSmtpHealth() {
  const response = await apiClient.get('/admin/feedback/smtp-health');
  return response.data;
}

export async function sendAdminFeedbackReply(feedbackId, { replyMessage, status, attachment }) {
  const formData = new FormData();
  formData.append('replyMessage', replyMessage || '');
  if (status) formData.append('status', status);
  if (attachment) formData.append('attachment', attachment);

  const response = await apiClient.post(`/admin/feedback/reports/${feedbackId}/reply`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function deleteAdminFeedbackReport(feedbackId, { deleteTarget = false } = {}) {
  const response = await apiClient.delete(`/admin/feedback/reports/${feedbackId}`, {
    params: {
      deleteTarget: deleteTarget ? 'true' : undefined,
    },
  });
  return response.data;
}
