// src/lib/api.js
// ==========================================================
// 🌍 Environment Detection & API Base Configuration
// ==========================================================

// Pull raw value from Vite env
let rawBase = import.meta.env.VITE_API_BASE || "";

// 🧹 Sanitize any accidental prefix
let base = rawBase.replace(/^VITE_API_BASE=/, "").trim();

// Environment detection
const hostname = window.location.hostname;
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);

// Auto-fallbacks if missing or empty
if (!base) {
  if (isLocalHost) {
    base = "http://localhost:3000/dev";
    console.log("✅ Using local Serverless Offline:", base);
  } else {
    // ✅ FIXED: Correct production fallback (your current API Gateway)
    base = "https://1u47jmgvaa.execute-api.eu-west-2.amazonaws.com/dev";
    console.log("🌍 Using production AWS API Gateway fallback:", base);
  }
} else {
  console.log("🧩 Using VITE_API_BASE override:", base);
}

// Normalize trailing slashes
export const API_BASE = base.replace(/\/+$/, "");

// Debug log
console.groupCollapsed("🌍 [API CONFIG DEBUG]");
console.log("• Hostname:", hostname);
console.log("• Local environment?", isLocalHost);
console.log("• Raw env:", rawBase);
console.log("• Final API_BASE:", API_BASE);
console.groupEnd();

// ==========================================================
// 🧰 URL Builder
// ==========================================================
function buildUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  const url = `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1");
  console.log("➡️ [API] Requesting:", url);
  return url;
}

// ==========================================================
// ✅ GET helper
// ==========================================================
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
    const parsed = JSON.parse(text || "{}");
    // ✅ Handle API Gateway "body" wrapper
    if (typeof parsed?.body === "string") {
      return JSON.parse(parsed.body);
    }
    return parsed;
  } catch (err) {
    console.warn(`⚠️ Non-JSON response from ${url}`, text);
    return {};
  }
}

// ==========================================================
// ✅ POST helper
// ==========================================================
export async function postJSON(path, body) {
  const url = buildUrl(path);

  console.log("📤 POSTing to:", url);
  console.log("📦 Payload:", body);

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
    const parsed = JSON.parse(text || "{}");
    // ✅ Handle API Gateway "body" wrapper
    if (typeof parsed?.body === "string") {
      return JSON.parse(parsed.body);
    }
    return parsed;
  } catch (err) {
    console.warn(`⚠️ Non-JSON response from ${url}`, text);
    return {};
  }
}

// ==========================================================
// ✅ Example helper (members)
// ==========================================================
export async function getMembers() {
  return getJSON("/members");
}
