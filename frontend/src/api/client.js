const BASE_URL = 'http://localhost:8000/api';

class ApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
  }

  getToken() {
    return localStorage.getItem('visage_token');
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request(method, endpoint, data = null, isFormData = false) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method,
      headers: this.getHeaders(isFormData),
    };

    if (data) {
      config.body = isFormData ? data : JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        localStorage.removeItem('visage_token');
        localStorage.removeItem('visage_user');
        window.location.href = '/login';
        throw new Error('Unauthorized — session expired');
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = new Error(errorBody.detail || errorBody.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = errorBody;
        throw error;
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.warn('API server unreachable — using offline mode');
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, data, isFormData = false) {
    return this.request('POST', endpoint, data, isFormData);
  }

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  }

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

const api = new ApiClient();
export default api;
