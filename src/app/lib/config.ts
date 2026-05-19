export function getApiUrl() {
  return import.meta.env.VITE_API_URL || window.location.origin;
}

export function getAdminWebSocketUrl(token: string) {
  const apiUrl = new URL(getApiUrl());
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/ws/admin";
  apiUrl.search = new URLSearchParams({ token }).toString();
  return apiUrl.toString();
}
