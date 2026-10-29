import axios from 'axios';
import { toast } from '@/components/ui/sonner';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    toast.error(error.response?.data?.message || 'Something went wrong');
    return Promise.reject(error);
  },
);

export default api;
