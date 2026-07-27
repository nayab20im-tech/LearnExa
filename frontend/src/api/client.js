import axios from 'axios';

export const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'
).replace(/\/+$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,

  /*
   * AI quiz generation may take longer on Vercel.
   */
  timeout: 120000,

  headers: {
    'Content-Type': 'application/json',
  },
});

/*
 * Send the stored JWT with every authenticated request.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => Promise.reject(error)
);

export const getGoogleAuthUrl = () =>
  `${API_ORIGIN}/api/auth/google`;

export const getApiErrorMessage = (
  error,
  fallback = 'Something went wrong. Please try again.'
) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Please try again.';
  }

  if (!error.response) {
    return `Cannot connect to the backend at ${API_ORIGIN}.`;
  }

  return fallback;
};

export default api;
