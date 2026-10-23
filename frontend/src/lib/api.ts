import axios, { InternalAxiosRequestConfig } from "axios";

export type BackendType = "vercel" | "render";

export const getVercelBackendUrl = (): string => {
  if (process.env.NEXT_PUBLIC_VERCEL_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_VERCEL_BACKEND_URL.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    // When running inside a browser, relative path ("") routes directly to FastAPI via vercel.json service rewrites
    return "";
  }
  return "https://nexus-enterprise-intelligence-platform.vercel.app";
};

export const getRenderBackendUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_RENDER_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://nexus-enterprise-intelligence-platform.onrender.com"
  ).trim().replace(/\/+$/, "");
};

// Set Vercel as the default active backend so the app is always up and instant
let activeBackend: BackendType = "vercel";

export const getActiveBackend = (): BackendType => {
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("nexus_active_backend") as BackendType | null;
    if (saved === "render" || saved === "vercel") {
      activeBackend = saved;
      return saved;
    }
    // If explicitly configured to prefer render via env var
    if (process.env.NEXT_PUBLIC_PRIMARY_BACKEND === "render") {
      activeBackend = "render";
      return "render";
    }
  }
  return activeBackend;
};

export const setActiveBackend = (backend: BackendType) => {
  activeBackend = backend;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("nexus_active_backend", backend);
    window.dispatchEvent(
      new CustomEvent("nexus_backend_change", {
        detail: { backend, url: getActiveBackendUrl(), name: getActiveBackendName() },
      })
    );
  }
};

export const getActiveBackendUrl = (): string => {
  return getActiveBackend() === "vercel" ? getVercelBackendUrl() : getRenderBackendUrl();
};

export const getActiveBackendName = (): string => {
  const backend = getActiveBackend();
  if (backend === "vercel") {
    return "Vercel Service (Active)";
  }
  const renderUrl = getRenderBackendUrl();
  return renderUrl.replace("https://", "");
};

export const getApiBase = (): string => {
  return getActiveBackendUrl();
};

export const api = axios.create({
  baseURL: getActiveBackendUrl(),
  timeout: 45000,
});

// Attach custom properties to Axios config
interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retryWithFallback?: boolean;
  _customBaseURL?: boolean;
}

// 1. Request Interceptor: inject active backend, JWT token, and internal firewall secret
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const customConfig = config as CustomRequestConfig;

  if (!customConfig._customBaseURL) {
    customConfig.baseURL = getActiveBackendUrl();
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      customConfig.headers.Authorization = `Bearer ${token}`;
    }
  }

  const internalSecret =
    process.env.NEXT_PUBLIC_RENDER_INTERNAL_SECRET ||
    process.env.PUBLIC_RENDER_INTERNAL_SECRET;
  if (internalSecret) {
    customConfig.headers["X-Internal-Secret"] = internalSecret.trim();
  }

  return customConfig;
});

// 2. Response Interceptor: automatic failover between backends
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as CustomRequestConfig | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isNetworkError = !error.response;
    const isServerError =
      error.response && [502, 503, 504].includes(error.response.status);
    const isTimeout =
      error.code === "ECONNABORTED" ||
      (error.message && error.message.toLowerCase().includes("timeout"));

    const shouldFailover =
      (isNetworkError || isServerError || isTimeout) &&
      !originalRequest._retryWithFallback;

    if (shouldFailover) {
      const currentBackend = getActiveBackend();
      const targetBackend: BackendType = currentBackend === "vercel" ? "render" : "vercel";
      const targetUrl = targetBackend === "vercel" ? getVercelBackendUrl() : getRenderBackendUrl();

      console.warn(
        `[Nexus API Failover] Current backend (${currentBackend}) failed (${error.message || error.response?.status}). Switching to ${targetBackend}...`
      );

      originalRequest._retryWithFallback = true;
      setActiveBackend(targetBackend);

      originalRequest.baseURL = targetUrl;
      originalRequest._customBaseURL = true;

      // Retry the exact request on fallback backend
      return api.request(originalRequest);
    }

    return Promise.reject(error);
  }
);
