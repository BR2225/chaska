const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();

export const API_BASE_URL = configuredBackendUrl
  ? configuredBackendUrl.replace(/\/+$/, "")
  : "";
