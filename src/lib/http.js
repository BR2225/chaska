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
// The cookie is written by the API host, so whether this origin can read it
// depends on the API's cookie domain and on the browser. The same hint is kept
// in this origin's own storage, so a refresh cannot lose track of a live session.
const SESSION_HINT_KEY = "chaska-session";

export function rememberSession() {
  try { localStorage.setItem(SESSION_HINT_KEY, "1"); } catch { /* storage unavailable */ }
}

export function forgetSession() {
  try { localStorage.removeItem(SESSION_HINT_KEY); } catch { /* storage unavailable */ }
}

export function hasStoredSession() {
  if (typeof document === "undefined") return false;
  if (/(?:^|;\s*)chaska_session=1(?:;|$)/.test(document.cookie)) return true;
  try { return localStorage.getItem(SESSION_HINT_KEY) === "1"; } catch { return false; }
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
      // Only the server refusing the refresh token ends the session. A rate
      // limit or a dropped connection says nothing about whether it is valid.
      if (refreshError.response?.status === 401) {
        forgetSession();
        window.dispatchEvent(new Event("chaska:auth-expired"));
      }
      return Promise.reject(refreshError);
    }
  },
);

export default http;
