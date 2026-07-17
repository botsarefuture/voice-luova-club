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

export async function loadPublicAcademyContent() {
  const response = await fetch("/api/academy/content", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Published Academy content is unavailable.");
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

export async function requestEmailVerification(email) {
  return secureRequest("/api/account/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
}

export async function loadReminderSettings() {
  const response = await fetch("/api/account/reminder", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load reminder settings.");
  return response.json();
}

export async function saveReminderSettings(settings) {
  return secureRequest("/api/account/reminder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function loadAcademyHistorySyncSettings() {
  const response = await fetch("/api/account/academy-history-sync", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load Academy history sync settings.");
  return response.json();
}

export async function saveAcademyHistorySyncSettings(enabled) {
  return secureRequest("/api/account/academy-history-sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function loadSyncedAcademyHistory() {
  const response = await fetch("/api/academy/history", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not load Academy history.");
  }
  return response.json();
}

export async function saveSyncedAcademyHistory(history) {
  return secureRequest("/api/academy/history", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });
}

export async function submitFeedback(payload) {
  return secureRequest("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

export async function loadAdminFeedback() {
  const response = await fetch("/api/admin/feedback", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not load feedback.");
  }
  return response.json();
}

export async function listAcademyAdminLessons() {
  const response = await fetch("/api/admin/academy/lessons", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not load Academy lessons.");
  }
  return response.json();
}

export async function loadAcademyAdminLesson(id, version) {
  const response = await fetch(`/api/admin/academy/lessons/${encodeURIComponent(id)}/${version}`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not load this lesson revision.");
  }
  return response.json();
}

export async function saveAcademyAdminLesson(id, version, lesson, changeNote) {
  return secureRequest(`/api/admin/academy/lessons/${encodeURIComponent(id)}/${version}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lesson, change_note: changeNote }) });
}

export async function submitAcademyAdminLessonForReview(id, version) {
  return secureRequest(`/api/admin/academy/lessons/${encodeURIComponent(id)}/${version}/submit-review`, { method: "PUT" });
}

export async function reviewAcademyAdminLesson(id, version, review) {
  return secureRequest(`/api/admin/academy/lessons/${encodeURIComponent(id)}/${version}/review`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review }) });
}

export async function publishAcademyAdminLesson(id, version) {
  return secureRequest(`/api/admin/academy/lessons/${encodeURIComponent(id)}/${version}/publish`, { method: "PUT" });
}

export async function listAcademyAdminCourses() {
  const response = await fetch("/api/admin/academy/courses", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load Academy courses.");
  return response.json();
}

export async function saveAcademyAdminCourse(id, version, course) {
  return secureRequest(`/api/admin/academy/courses/${encodeURIComponent(id)}/${version}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course }) });
}

export async function submitAcademyAdminCourseForReview(id, version) { return secureRequest(`/api/admin/academy/courses/${encodeURIComponent(id)}/${version}/submit-review`, { method: "PUT" }); }
export async function reviewAcademyAdminCourse(id, version, review) { return secureRequest(`/api/admin/academy/courses/${encodeURIComponent(id)}/${version}/review`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review }) }); }
export async function publishAcademyAdminCourse(id, version) { return secureRequest(`/api/admin/academy/courses/${encodeURIComponent(id)}/${version}/publish`, { method: "PUT" }); }

export async function listAcademyAdminMedia() {
  const response = await fetch("/api/admin/academy/media", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load Academy media.");
  return response.json();
}

export async function loadAcademyAdminMedia(id, version, locale) {
  const response = await fetch(`/api/admin/academy/media/${encodeURIComponent(id)}/${version}/${encodeURIComponent(locale)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load this media revision.");
  return response.json();
}

export async function saveAcademyAdminMedia(id, version, locale, asset) {
  return secureRequest(`/api/admin/academy/media/${encodeURIComponent(id)}/${version}/${encodeURIComponent(locale)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset }) });
}

export async function submitAcademyAdminMediaForReview(id, version, locale) {
  return secureRequest(`/api/admin/academy/media/${encodeURIComponent(id)}/${version}/${encodeURIComponent(locale)}/submit-review`, { method: "PUT" });
}

export async function reviewAcademyAdminMedia(id, version, locale, review) {
  return secureRequest(`/api/admin/academy/media/${encodeURIComponent(id)}/${version}/${encodeURIComponent(locale)}/review`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review }) });
}

export async function publishAcademyAdminMedia(id, version, locale) {
  return secureRequest(`/api/admin/academy/media/${encodeURIComponent(id)}/${version}/${encodeURIComponent(locale)}/publish`, { method: "PUT" });
}

export async function listPrivateRecordings() {
  const response = await fetch("/api/recordings", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load private recordings.");
  const payload = await response.json();
  return payload;
}

export async function uploadPrivateRecording(recording, ciphertext) {
  const token = await getCsrfToken();
  const form = new FormData();
  form.append("audio", ciphertext, "encrypted-recording.bin");
  form.append("id", recording.id);
  form.append("label", recording.label);
  form.append("duration_ms", String(recording.durationMs));
  form.append("mime_type", recording.mimeType);
  form.append("encryption_version", String(recording.encryptionVersion));
  form.append("iv", JSON.stringify(recording.iv));
  const response = await fetch("/api/recordings", { method: "POST", headers: { "X-CSRF-Token": token }, body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not save your recording.");
  }
  return response.json();
}

export async function downloadPrivateRecording(id) {
  const response = await fetch(`/api/recordings/${encodeURIComponent(id)}`, { headers: { Accept: "application/octet-stream" } });
  if (!response.ok) throw new Error("Could not open that recording.");
  return {
    ciphertext: await response.blob(),
    iv: JSON.parse(response.headers.get("X-FemmeVoice-IV") || "[]"),
    mimeType: response.headers.get("X-FemmeVoice-Mime") || "audio/webm",
  };
}

export async function removePrivateRecording(id) {
  return secureRequest(`/api/recordings/${encodeURIComponent(id)}`, { method: "DELETE" });
}
