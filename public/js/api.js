const IS_NETLIFY = window.location.hostname.includes('netlify.app');
const API_BASE = IS_NETLIFY
  ? '/.netlify/functions/api?route='
  : '/api.php?route=';

let backendAvailable = true;

const api = {
  _adminToken: sessionStorage.getItem('adminToken') || null,

  setAdminToken(token) {
    this._adminToken = token;
    if (token) sessionStorage.setItem('adminToken', token);
    else sessionStorage.removeItem('adminToken');
  },

  _getAuthHeaders() {
    if (this._adminToken) {
      return { 'Authorization': 'Bearer ' + this._adminToken };
    }
    return {};
  },

  async request(path, options = {}) {
    if (!backendAvailable) {
      throw new Error('backend_offline');
    }
    const [routePath, qs] = path.includes('?') ? path.split('?') : [path, ''];
    let url = `${API_BASE}${routePath}`;
    if (qs) url += `&${qs}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this._getAuthHeaders(),
        ...(options.headers || {})
      },
      ...options
    };
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }
    try {
      const res = await fetch(url, config);
      if (res.status === 401) {
        this.setAdminToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('unauthorized');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      const text = await res.text();
      if (!text || text.startsWith('<')) {
        backendAvailable = false;
        throw new Error('backend_offline');
      }
      return JSON.parse(text);
    } catch (e) {
      if (e.message === 'backend_offline') throw e;
      if (e.message === 'unauthorized') throw e;
      if (e.name === 'TypeError' || e.name === 'SyntaxError') {
        backendAvailable = false;
      }
      throw e;
    }
  },

  adminLogin(username, password) {
    return this.request('/admin/login', {
      method: 'POST',
      body: { username, password }
    });
  },

  adminVerify() {
    return this.request('/admin/verify');
  },

  getEvents() {
    return this.request('/events');
  },

  getPosts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/posts${q ? `?${q}` : ''}`);
  },

  getPostsPaginated(params = {}) {
    const q = new URLSearchParams({ ...params, limit: params.limit || '6' }).toString();
    return this.request(`/posts${q ? `?${q}` : ''}`);
  },

  getPost(id) {
    return this.request(`/posts/${id}`);
  },

  createPost(data) {
    return this.request('/posts', { method: 'POST', body: data });
  },

  updatePost(id, data) {
    return this.request(`/posts/${id}`, { method: 'PUT', body: data });
  },

  deletePost(id) {
    return this.request(`/posts/${id}`, { method: 'DELETE' });
  },

  likePost(id) {
    return this.request(`/posts/${id}/like`, { method: 'POST' });
  },

  dislikePost(id) {
    return this.request(`/posts/${id}/dislike`, { method: 'POST' });
  },

  ratePost(id, rating) {
    return this.request(`/posts/${id}/rate`, { method: 'POST', body: { rating } });
  },

  getComments(postId) {
    return this.request(`/posts/${postId}/comments`);
  },

  addComment(postId, data) {
    return this.request(`/posts/${postId}/comments`, { method: 'POST', body: data });
  },

  addEmoji(postId, commentId, emoji) {
    return this.request(`/posts/${postId}/comments/${commentId}/emoji`, { method: 'POST', body: { emoji } });
  },

  likeComment(postId, commentId) {
    return this.request(`/posts/${postId}/comments/${commentId}/like`, { method: 'POST' });
  },

  dislikeComment(postId, commentId) {
    return this.request(`/posts/${postId}/comments/${commentId}/dislike`, { method: 'POST' });
  },

  uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/uploads/image', {
      method: 'POST',
      headers: {},
      body: formData
    });
  },

  uploadVideo(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/uploads/video', {
      method: 'POST',
      headers: {},
      body: formData
    });
  },

  getAnalytics() {
    return this.request('/analytics');
  },

  subscribeNewsletter(email) {
    return this.request('/newsletter', { method: 'POST', body: { email } });
  },

  getSubscribers() {
    return this.request('/newsletter');
  },

  getAds() {
    return this.request('/ads');
  },

  saveAds(config) {
    return this.request('/ads', { method: 'POST', body: config });
  }
};
