// src/lib/api.js

// ----------------------------------------------------------
// 🌍 Environment Detection & Logging
// ----------------------------------------------------------

let base = import.meta.env.VITE_API_BASE || "";

const hostname = window.location.hostname;
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);

console.groupCollapsed("🌍 [API CONFIG DEBUG]");
console.log("• VITE_API_BASE from .env:", base);
console.log("• Hostname:", hostname);
console.log("• Local environment?", isLocalHost);
console.groupEnd();

// Auto-fallbacks
if (!base) {
  if (isLocalHost) {
    base = "http://localhost:3000/dev";
    console.log("✅ Using local Serverless Offline:", base);
  } else {
    base = "https://byu72oz79h.execute-api.eu-west-2.amazonaws.com/dev";
    console.log("🌍 Using production AWS API Gateway:", base);
  }
} else {
  console.log("🧩 Using VITE_API_BASE override:", base);
}

// Final normalized base (no trailing slash)
export const API_BASE = base.replace(/\/+$/, "");
console.log("🚀 Final API_BASE:", API_BASE);

// ----------------------------------------------------------
// 🧰 URL Builder (ensures exactly one slash)
// ----------------------------------------------------------
function buildUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  const url = `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1");
  console.log("➡️ [API] Requesting:", url);
  return url;
}

// ----------------------------------------------------------
// ✅ GET helper
// ----------------------------------------------------------
export async function getJSON(path) {
  const url = buildUrl(path);

  const res = await fetch(url, {
    method: "GET",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ GET ${url} failed: ${res.status} ${res.statusText}`);
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  try {
    return JSON.parse(text || "{}");
  } catch {
    console.warn(`⚠️ Non-JSON response from ${url}`);
    return {};
  }
}

// ----------------------------------------------------------
// ✅ POST helper
// ----------------------------------------------------------
export async function postJSON(path, body) {
  const url = buildUrl(path);

  const res = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ POST ${url} failed: ${res.status} ${res.statusText}`);
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  try {
    return JSON.parse(text || "{}");
  } catch {
    console.warn(`⚠️ Non-JSON response from ${url}`);
    return {};
  }
}

// ----------------------------------------------------------
// ✅ Example helper (members)
// ----------------------------------------------------------
export async function getMembers() {
  return getJSON("/members");
}
