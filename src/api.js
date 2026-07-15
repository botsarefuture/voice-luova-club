let csrfToken = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not establish a secure session.");
  const payload = await response.json();
  csrfToken = payload.csrf_token;
  return csrfToken;
}

async function secureRequest(url, options = {}) {
  const token = await getCsrfToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
      "X-CSRF-Token": token,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Something went wrong. Please try again.");
  }
  return response.json();
}

export async function loadCloudProgress(deviceId) {
  const response = await fetch(`/api/progress/${encodeURIComponent(deviceId)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Progress load failed: ${response.status}`);
  const payload = await response.json();
  return payload.progress;
}

export async function saveCloudProgress(deviceId, progress) {
  return secureRequest(`/api/progress/${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ progress }),
  });
}

export async function loadMe() {
  const response = await fetch("/api/me", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return { authenticated: false, user: null };
  return response.json();
}

export async function registerAccount(payload) {
  return secureRequest("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginAccount(payload) {
  return secureRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function logoutAccount() {
  const result = await secureRequest("/api/auth/logout", { method: "POST" });
  csrfToken = null;
  return result;
}

export async function exportAccountData() {
  return secureRequest("/api/privacy/export");
}

export async function deleteAccount() {
  const result = await secureRequest("/api/privacy/account", { method: "DELETE" });
  csrfToken = null;
  return result;
}
