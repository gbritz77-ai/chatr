// scripts/deploy-and-sync.js
import "dotenv/config";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const REGION = process.env.AWS_REGION || "eu-west-2";
const STAGE = process.env.STAGE || "dev";
const ENV_PATH = process.env.FRONTEND_ENV_PATH || "C:/Dev/Chatr/.env";
const FRONTEND_PATH = process.env.FRONTEND_PATH || "C:/Dev/Chatr/frontend";
const BUCKET = process.env.ATTACHMENTS_BUCKET || "outsec-chat-bucket";
const OVERRIDE_BASE = process.env.API_GATEWAY_BASE;

const log = (...a) => console.log("🔧", ...a);

function run(cmd, cwd = ".") {
  console.log(`\n🧠 Running: ${cmd}`);
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
}

function extractBaseFromInfo(infoOutput) {
  const endpointLines = infoOutput
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.match(/^[A-Z]+ - https:\/\/[a-z0-9]+\.execute-api\.[^/]+\/[A-Za-z0-9_-]+/));

  if (endpointLines.length === 0) return null;

  const bases = endpointLines
    .map(l => {
      const match = l.match(/https:\/\/[a-z0-9]+\.execute-api\.[^/]+\/[A-Za-z0-9_-]+/);
      return match ? match[0] : null;
    })
    .filter(Boolean);

  const exact = bases.find(b => b.endsWith(`/${STAGE}`));
  return exact || bases[0];
}

try {
  console.log("🚀 Deploying CHATr backend…");

  // 1️⃣ Deploy backend
  const deployOut = run(`npx serverless deploy --stage ${STAGE} --region ${REGION}`);
  console.log(deployOut);

  // 2️⃣ Fetch info
  const infoOut = run(`npx serverless info --stage ${STAGE} --region ${REGION} --verbose`);
  const base = OVERRIDE_BASE || extractBaseFromInfo(infoOut);

  if (!base) {
    console.error("❌ Could not determine API base URL from Serverless outputs.");
    process.exit(1);
  }

  console.log(`✅ API base detected: ${base}`);

  // 3️⃣ Update .env for frontend
  const envPath = path.normalize(ENV_PATH);
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  envContent = envContent.replace(/^\s*VITE_API_BASE=.*$/m, "").trim();
  envContent += `\nVITE_API_BASE=${base}\n`;

  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, envContent);

  console.log(`🌍 Updated ${envPath}`);
  console.log(`🔗 VITE_API_BASE=${base}`);

  // 4️⃣ Build frontend
  console.log("🏗️ Building frontend...");
  run("npm run build", FRONTEND_PATH);

  // 5️⃣ Sync build to S3 (optional)
  console.log("☁️ Syncing dist to S3...");
  run(`aws s3 sync ${FRONTEND_PATH}/dist s3://${BUCKET} --delete`);

  console.log("🎉 Full deployment completed successfully!");
  console.log(`🔗 API Base: ${base}`);
  console.log(`🌐 S3 Bucket: ${BUCKET}`);
} catch (err) {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
}
