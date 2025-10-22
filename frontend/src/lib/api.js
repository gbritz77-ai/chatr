// src/lib/api.js

// ----------------------------------------------------------
// 🧠 Debugging & Environment Detection
// ----------------------------------------------------------

// Step 1: Read .env variable injected by Vite
let base = import.meta.env.VITE_API_BASE;

// Step 2: Check host
const hostname = window.location.hostname;
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);

// Step 3: Log initial state
console.groupCollapsed("🌍 [API CONFIG DEBUG]");
console.log("• VITE_API_BASE from .env:", base);
console.log("• Detected window.location.hostname:", hostname);
console.log("• Detected isLocalHost:", isLocalHost);
console.groupEnd();

// Step 4: Auto-detect fallback if not provided
if (!base) {
  if (isLocalHost) {
    base = "http://localhost:3000/dev";
    console.log("✅ Using local Serverless Offline:", base);
  } else {
    base = "https://i2w2psstbe.execute-api.eu-west-2.amazonaws.com/dev";
    console.log("🌍 Using production AWS API Gateway:", base);
  }
} else {
  console.log("🧩 Using VITE_API_BASE override:", base);
}

// Step 5: Normalize trailing slash
const API_BASE = base.replace(/\/+$/, "");
console.log("🚀 Final API_BASE:", API_BASE);

// Helper to build clean URL
function buildUrl(path) {
  if (!path.startsWith("/")) path = `/${path}`;
  const url = `${API_BASE}${path}`;
  console.log("➡️  Requesting:", url);
  return url;
}

// ----------------------------------------------------------
// ✅ GET helper
// ----------------------------------------------------------
export async function getJSON(path) {
  const url = buildUrl(path);
  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ GET ${url} failed: ${res.status} ${res.statusText}`);
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  try {
    return JSON.parse(text || "{}");
  } catch {
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`❌ POST ${url} failed: ${res.status} ${res.statusText}`);
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

// ----------------------------------------------------------
// ✅ Example helper (members)
// ----------------------------------------------------------
export async function getMembers() {
  return getJSON("/members");
}

export { API_BASE };
