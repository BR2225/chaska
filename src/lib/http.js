import axios from "axios";
import { API_BASE_URL } from "@/config/api";

const http = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 15000,
  withCredentials: true,
});

let refreshPromise = null;

function isAuthenticationRequest(url = "") {
  return /\/api\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(url);
}

// Set alongside the httponly auth cookies and expiring with them, so the app can
// tell a visitor who never signed in from one whose access token has lapsed.
// Without it every anonymous page load fired a refresh that could only 401.
export function hasStoredSession() {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)chaska_session=1(?:;|$)/.test(document.cookie);
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    if (
      error.response?.status !== 401
      || !request
      || request.__chaskaAuthRetry
      || isAuthenticationRequest(request.url)
      || !hasStoredSession()
    ) {
      return Promise.reject(error);
    }

    request.__chaskaAuthRetry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { timeout: 15000, withCredentials: true },
        ).finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return http(request);
    } catch (refreshError) {
      window.dispatchEvent(new Event("chaska:auth-expired"));
      return Promise.reject(refreshError);
    }
  },
);

export default http;
