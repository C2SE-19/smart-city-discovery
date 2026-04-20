import apiClient from './client';

export async function fetchForumPosts() {
  const response = await apiClient.get('/forum/posts');
  return response?.data?.data || [];
}

export async function createForumPost(payload) {
  const response = await apiClient.post('/forum/posts', payload);
  return response?.data?.data;
}

export async function createForumComment(postId, payload) {
  const response = await apiClient.post(`/forum/posts/${postId}/comments`, payload);
  return response?.data?.data;
}

export async function toggleForumPostLike(postId, actorKey) {
  const response = await apiClient.post(`/forum/posts/${postId}/likes/toggle`, { actorKey });
  return response?.data?.data;
}

export async function reportForumPost(postId, payload) {
  const response = await apiClient.post(`/forum/posts/${postId}/report`, payload);
  return response?.data?.data;
}

export async function reportForumComment(postId, commentId, payload) {
  const response = await apiClient.post(`/forum/posts/${postId}/comments/${commentId}/report`, payload);
  return response?.data?.data;
}

export async function deleteForumPost(postId, payload) {
  const response = await apiClient.delete(`/forum/posts/${postId}`, { data: payload });
  return response?.data?.data;
}

export async function deleteForumComment(postId, commentId, payload) {
  const response = await apiClient.delete(`/forum/posts/${postId}/comments/${commentId}`, { data: payload });
  return response?.data?.data;
}
