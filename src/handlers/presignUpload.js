// src/handlers/presignUpload.js
const AWS = require("aws-sdk");
const crypto = require("crypto");
const { response } = require("../helpers/response"); // ✅ shared CORS-safe helper

// Ensure AWS region consistency
AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET = process.env.ATTACHMENTS_BUCKET || "outsec-chat-bucket";

/* ============================================================
   🧠 Presign Upload Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📦 PRESIGN UPLOAD EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "POST").toUpperCase();

  // ✅ CORS preflight
  if (method === "OPTIONS") {
    console.log("🟢 CORS preflight OK");
    return response(200, { message: "CORS preflight success" });
  }

  // ✅ Only allow POST
  if (method !== "POST") {
    console.warn(`🚫 Unsupported method: ${method}`);
    return response(405, { success: false, message: "Method not allowed" });
  }

  try {
    /* ============================================================
       🧩 Parse and validate body
    ============================================================= */
    let body = {};
    try {
      body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
    } catch {
      console.warn("⚠️ Invalid JSON body received");
      return response(400, { success: false, message: "Invalid JSON body" });
    }

    const { filename, contentType, folder } = body;

    if (!filename || !contentType) {
      console.warn("⚠️ Missing filename or contentType");
      return response(400, {
        success: false,
        message: "Missing filename or contentType",
      });
    }

    if (!BUCKET) {
      console.error("❌ Missing ATTACHMENTS_BUCKET environment variable");
      return response(500, { success: false, message: "Server misconfiguration: no S3 bucket" });
    }

    /* ============================================================
       🪶 Generate unique key
    ============================================================= */
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const folderPrefix = folder ? `${folder.replace(/[^a-zA-Z0-9/_-]/g, "_")}/` : "attachments/";
    const key = `${folderPrefix}${Date.now()}-${uniqueId}-${safeName}`;

    /* ============================================================
       🪣 Generate presigned URLs
    ============================================================= */
    const uploadURL = await s3.getSignedUrlPromise("putObject", {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Expires: 300, // 5 minutes
      ACL: "private",
    });

    // Optional view URL for immediate preview (24 hours)
    const viewURL = await s3.getSignedUrlPromise("getObject", {
      Bucket: BUCKET,
      Key: key,
      Expires: 86400,
    });

    console.log("✅ Presigned upload URL generated:", { key, BUCKET });

    return response(200, {
      success: true,
      message: "Presigned URL generated successfully",
      uploadURL,
      viewURL,
      key,
      bucket: BUCKET,
      expiresInSeconds: 300,
      contentType,
    });
  } catch (err) {
    console.error("❌ PRESIGN UPLOAD ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  }
};
