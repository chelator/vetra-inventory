const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

let authToken = null;

try {
  authToken = localStorage.getItem("vetra-auth-token");
} catch {}

export function setToken(token) {
  authToken = token;
  try { localStorage.setItem("vetra-auth-token", token); } catch {}
}

export function clearToken() {
  authToken = null;
  try { localStorage.removeItem("vetra-auth-token"); } catch {}
}

export function getToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("vetra-auth-expired"));
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// Auth
export const auth = {
  register: (email, password, name) => request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/auth/me"),
};

// Items
export const items = {
  list: () => request("/items"),
  create: (data) => request("/items", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  adjust: (id, delta) => request(`/items/${id}/adjust`, { method: "PATCH", body: JSON.stringify({ delta }) }),
  remove: (id) => request(`/items/${id}`, { method: "DELETE" }),
  bulkImport: (items) => request("/items/bulk", { method: "POST", body: JSON.stringify({ items }) }),
};

// Projects
export const projects = {
  list: () => request("/projects"),
  get: (id) => request(`/projects/${id}`),
  create: (name) => request("/projects", { method: "POST", body: JSON.stringify({ name }) }),
  update: (id, data) => request(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/projects/${id}`, { method: "DELETE" }),
  getActive: () => request("/projects/active/current"),
  setActive: (projectId) => request("/projects/active/current", { method: "PUT", body: JSON.stringify({ projectId }) }),
  // Turbines
  addTurbine: (projectId, name) => request(`/projects/${projectId}/turbines`, { method: "POST", body: JSON.stringify({ name }) }),
  updateTurbine: (id, data) => request(`/projects/turbines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTurbine: (id) => request(`/projects/turbines/${id}`, { method: "DELETE" }),
  duplicateTurbine: (projectId, turbineId, name) => request(`/projects/${projectId}/turbines/${turbineId}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }),
  // Blades
  addBlade: (turbineId, name) => request(`/projects/turbines/${turbineId}/blades`, { method: "POST", body: JSON.stringify({ name }) }),
  addMultipleBlades: (turbineId, names) => request(`/projects/turbines/${turbineId}/blades`, { method: "POST", body: JSON.stringify({ names }) }),
  updateBlade: (id, data) => request(`/projects/blades/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBlade: (id) => request(`/projects/blades/${id}`, { method: "DELETE" }),
  // Damages
  addDamage: (bladeId, data) => request(`/projects/blades/${bladeId}/damages`, { method: "POST", body: JSON.stringify(data) }),
  updateDamage: (id, data) => request(`/projects/damages/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDamage: (id) => request(`/projects/damages/${id}`, { method: "DELETE" }),
};

// Jobs
export const jobs = {
  list: () => request("/jobs"),
  create: (data) => request("/jobs", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/jobs/${id}`, { method: "DELETE" }),
};

// Health check — used to detect if backend is available
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
