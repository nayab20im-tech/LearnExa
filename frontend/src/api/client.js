import axios from 'axios';

export const API_ORIGIN = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getGoogleAuthUrl = () => `${API_ORIGIN}/api/auth/google`;

export const getApiErrorMessage = (
  error,
  fallback = 'Something went wrong. Please try again.'
) => {
  if (error.response?.data?.message) return error.response.data.message;

  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Check that the backend and MongoDB are running.';
  }

  if (!error.response) {
    return `Cannot connect to the backend at ${API_ORIGIN}. Start the backend and verify its MongoDB connection.`;
  }

  return fallback;
};

export default api;
