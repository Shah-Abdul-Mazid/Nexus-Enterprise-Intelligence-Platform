import axios from "axios";

export const getApiBase = () => {
  return process.env.PUBLIC_API_URL || process.env.PUBLIC_BACKEND_URL;
};

export const api = axios.create({
  baseURL: getApiBase(),
  timeout: 60000,
});

// Interceptor to add Authorization header and Internal Secret firewall header
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // 1. Attach JWT token for authenticated user requests
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // 2. Attach shared internal secret header to satisfy backend firewall
  const internalSecret = process.env.PUBLIC_RENDER_INTERNAL_SECRET;
  if (internalSecret) {
    config.headers["X-Internal-Secret"] = internalSecret;
  }

  return config;
});
