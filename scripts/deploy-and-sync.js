// scripts/deploy-and-sync.js
import 'dotenv/config';
import { execSync } from "child_process";
import fs from "fs";
import path from "path";


const REGION = process.env.AWS_REGION || "eu-west-2";
const STAGE = process.env.STAGE || "dev";
const ENV_PATH = process.env.FRONTEND_ENV_PATH || "C:/Dev/Chatr/.env"; // your path
const OVERRIDE_BASE = process.env.API_GATEWAY_BASE; // optional manual override

const log = (...a) => console.log("🔧", ...a);

console.log("🚀 Deploying CHATr backend to AWS…");

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
}

function extractBaseFromInfo(infoOutput) {
  // Find all endpoint lines, e.g. "  POST - https://abc123.execute-api.eu-west-2.amazonaws.com/dev/auth"
  console.log("🚀 Find all endpoint lines, e.g.   POST - https://abc123.execute-api.eu-west-2.amazonaws.com/dev/auth");
  const endpointLines = infoOutput
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.match(/^[A-Z]+ - https:\/\/[a-z0-9]+\.execute-api\.[^/]+\/[^/\s]+\/?/));

  if (endpointLines.length === 0) return null;

  // Map to base URLs (up to the stage)
  console.log("🚀 Map to base URLs (up to the stage)");
  console.log("🧩 Checking process.env.VITE_API_BASE:", process.env.VITE_API_BASE);
  const bases = endpointLines
    .map(l => {
      const m = l.match(/https:\/\/[a-z0-9]+\.execute-api\.[^/]+\/([A-Za-z0-9_-]+)(?:\/|$)/);
      if (!m) return null;
      const full = l.match(/https:\/\/[a-z0-9]+\.execute-api\.[^/]+\/[A-Za-z0-9_-]+/);
      return full ? full[0] : null;
    })
    .filter(Boolean);

  // Prefer the one that matches the requested STAGE exactly
  console.log("🚀 Prefer the one that matches the requested STAGE exactly");
  const exact = bases.find(b => b.endsWith(`/${STAGE}`));
  return exact || bases[0];
}

try {
  // 1) Deploy
  console.log("🚀 1) Deploy");
  const deployOut = run(`npx serverless deploy --stage ${STAGE} --region ${REGION}`);
  console.log(deployOut);

  // 2) Get canonical info for this deployed service
  console.log("🚀 2) Get canonical info for this deployed service");
  const infoOut = run(`npx serverless info --stage ${STAGE} --region ${REGION} --verbose`);
  log("Fetched stack info.");

  // 3) Decide base URL
  console.log("🚀 3) Decide base URL");
  let base =
    OVERRIDE_BASE ||
    extractBaseFromInfo(infoOut);

  if (!base) {
    // Fallback: try to parse directly from deploy output
    console.log("🚀 Fallback: try to parse directly from deploy output");
    const m = deployOut.match(
      new RegExp(`https:\\/\\/[a-z0-9]+\\.execute-api\\.${REGION}\\.amazonaws\\.com\\/${STAGE}`)
    );
    if (m) base = m[0];
  }

  if (!base) {
    console.error("❌ Could not determine API base URL from Serverless outputs.");
    process.exit(1);
  }

  console.log(`✅ API base detected: ${base}`);

  // 4) Update .env at your known path
  console.log("🚀 4) Update .env at your known path");
  const envPath = path.normalize(ENV_PATH);
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (envContent.includes("VITE_API_BASE=")) {
    envContent = envContent.replace(/^\s*VITE_API_BASE=.*$/m, `VITE_API_BASE=${base}`);
  } else {
    envContent = (envContent ? envContent.trim() + "\n" : "") + `VITE_API_BASE=${base}\n`;
  }

  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, envContent);

  console.log(`🌍 Updated ${envPath}`);
  console.log(`🔗 VITE_API_BASE=${base}`);
  console.log("🎉 Deployment complete and .env synchronized.");
} catch (err) {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
}
