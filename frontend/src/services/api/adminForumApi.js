import apiClient from './client';

export async function fetchAdminForumPosts({ search } = {}) {
  const params = {};

  if (String(search || '').trim()) {
    params.search = String(search).trim();
  }

  const response = await apiClient.get('/admin/forum/posts', { params });
  return response?.data?.data || [];
}

export async function deleteAdminForumPost(postId) {
  const response = await apiClient.delete(`/admin/forum/posts/${postId}`);
  return response?.data?.data || null;
}

export async function deleteAdminForumComment(postId, commentId) {
  const response = await apiClient.delete(`/admin/forum/posts/${postId}/comments/${commentId}`);
  return response?.data?.data || null;
}

export async function dismissAdminForumPostReports(postId) {
  const response = await apiClient.delete(`/admin/forum/posts/${postId}/reports`);
  return response?.data?.data || null;
}

export async function dismissAdminForumCommentReports(postId, commentId) {
  const response = await apiClient.delete(`/admin/forum/posts/${postId}/comments/${commentId}/reports`);
  return response?.data?.data || null;
}

export async function fetchAdminForumBannedKeywords() {
  const response = await apiClient.get('/admin/forum/banned-keywords');
  return response?.data?.data || [];
}

export async function createAdminForumBannedKeyword(keyword) {
  const response = await apiClient.post('/admin/forum/banned-keywords', { keyword });
  return response?.data?.data || null;
}

export async function deleteAdminForumBannedKeyword(keywordId) {
  const response = await apiClient.delete(`/admin/forum/banned-keywords/${keywordId}`);
  return response?.data?.data || null;
}
