import axios, { InternalAxiosRequestConfig } from "axios";

export type BackendType = "render" | "vercel";

export const getRenderBackendUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_RENDER_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://nexus-enterprise-intelligence-platform.onrender.com"
  ).trim().replace(/\/+$/, "");
};

export const getVercelBackendUrl = (): string => {
  if (process.env.NEXT_PUBLIC_VERCEL_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_VERCEL_BACKEND_URL.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    // When running inside a browser on Vercel, relative path ("") routes to FastAPI via vercel.json service rewrites
    if (window.location.hostname.includes("vercel.app")) {
      return "";
    }
  }
  return "https://nexus-enterprise-intelligence-platform-qzwtkbohl.vercel.app";
};

// Failover state management
let activeBackend: BackendType = "render";
const FAILOVER_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes before re-probing Render

export const getActiveBackend = (): BackendType => {
  if (typeof window !== "undefined") {
    const saved = sessionStorage.getItem("nexus_active_backend") as BackendType | null;
    const savedTime = parseInt(sessionStorage.getItem("nexus_failover_time") || "0", 10);
    if (saved === "vercel") {
      if (Date.now() - savedTime < FAILOVER_COOLDOWN_MS) {
        activeBackend = "vercel";
        return "vercel";
      } else {
        // Cooldown passed, try Render again as primary
        activeBackend = "render";
        sessionStorage.removeItem("nexus_active_backend");
        sessionStorage.removeItem("nexus_failover_time");
      }
    }
  }
  return activeBackend;
};

export const setActiveBackend = (backend: BackendType) => {
  activeBackend = backend;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("nexus_active_backend", backend);
    if (backend === "vercel") {
      sessionStorage.setItem("nexus_failover_time", Date.now().toString());
    } else {
      sessionStorage.removeItem("nexus_failover_time");
    }
    window.dispatchEvent(
      new CustomEvent("nexus_backend_change", {
        detail: { backend, url: getActiveBackendUrl(), name: getActiveBackendName() },
      })
    );
  }
};

export const getActiveBackendUrl = (): string => {
  return getActiveBackend() === "render" ? getRenderBackendUrl() : getVercelBackendUrl();
};

export const getActiveBackendName = (): string => {
  const backend = getActiveBackend();
  if (backend === "vercel") {
    return "Vercel (Failover Active)";
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

// 2. Response Interceptor: automatic failover from Render to Vercel
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

    const currentBase = originalRequest.baseURL || getActiveBackendUrl();
    const isRenderRequest =
      currentBase.includes("onrender.com") || getActiveBackend() === "render";

    if (shouldFailover && isRenderRequest) {
      console.warn(
        `[Nexus API Failover] Render backend failed (${error.message || error.response?.status}). Automatically switching to Vercel backend...`
      );

      originalRequest._retryWithFallback = true;
      setActiveBackend("vercel");

      const vercelUrl = getVercelBackendUrl();
      originalRequest.baseURL = vercelUrl;
      originalRequest._customBaseURL = true;

      // Retry the exact request on Vercel backend
      return api.request(originalRequest);
    }

    return Promise.reject(error);
  }
);

// 3. Proactive Health Probe (runs on browser load and periodically)
if (typeof window !== "undefined") {
  const probeRenderHealth = () => {
    if (getActiveBackend() === "render") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000); // 4s timeout

      fetch(`${getRenderBackendUrl()}/health`, {
        signal: controller.signal,
        mode: "cors",
      })
        .then((res) => {
          clearTimeout(timer);
          if (!res.ok) {
            console.warn(
              `[Nexus Probe] Render healthcheck failed (HTTP ${res.status}). Switching to Vercel backend.`
            );
            setActiveBackend("vercel");
          }
        })
        .catch((err) => {
          clearTimeout(timer);
          console.warn(
            `[Nexus Probe] Render unreachable or sleeping (${err.message}). Proactively switching to Vercel backend.`
          );
          setActiveBackend("vercel");
        });
    } else {
      // If currently on Vercel fallback, periodically probe if Render has recovered
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      fetch(`${getRenderBackendUrl()}/health`, {
        signal: controller.signal,
        mode: "cors",
      })
        .then((res) => {
          clearTimeout(timer);
          if (res.ok) {
            console.info(
              "[Nexus Probe] Render backend has recovered! Switching back to Render as primary backend."
            );
            setActiveBackend("render");
          }
        })
        .catch(() => {
          clearTimeout(timer);
        });
    }
  };

  // Run initial probe shortly after startup
  setTimeout(probeRenderHealth, 200);

  // Periodically probe every 3 minutes
  setInterval(probeRenderHealth, 3 * 60 * 1000);
}
