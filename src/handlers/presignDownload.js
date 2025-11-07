// src/handlers/presignDownload.js
const AWS = require("aws-sdk");
const { response } = require("../helpers/response"); // ✅ Shared CORS-safe helper

AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });

const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET = process.env.ATTACHMENTS_BUCKET || "outsec-chat-bucket";

/* ============================================================
   🧠 Presign Download Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📥 PRESIGN DOWNLOAD EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "GET").toUpperCase();

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    console.log("🟢 CORS preflight OK");
    return response(200, { message: "CORS preflight success" });
  }

  try {
    /* ============================================================
       📦 Parse body or query params
    ============================================================= */
    let key = "";
    if (method === "POST") {
      try {
        const body = JSON.parse(event.body || "{}");
        key = decodeURIComponent(body.key || body.fileKey || "").trim();
      } catch {
        console.warn("⚠️ Invalid JSON body received");
        return response(400, { success: false, message: "Invalid JSON body" });
      }
    } else if (method === "GET") {
      key = decodeURIComponent(
        event.queryStringParameters?.key || event.queryStringParameters?.fileKey || ""
      ).trim();
    }

    if (!key) {
      console.warn("⚠️ Missing 'key' or 'fileKey' in request.");
      return response(400, { success: false, message: "Missing file key" });
    }

    if (!BUCKET) {
      console.error("❌ Missing ATTACHMENTS_BUCKET env variable");
      return response(500, {
        success: false,
        message: "Server misconfiguration: no S3 bucket defined",
      });
    }

    console.log(`🪣 Generating presigned download URL for s3://${BUCKET}/${key}`);

    /* ============================================================
       🔍 Check file exists (HEAD request)
    ============================================================= */
    let head;
    try {
      head = await s3.headObject({ Bucket: BUCKET, Key: key }).promise();
    } catch (err) {
      if (err.code === "NotFound" || err.code === "NoSuchKey") {
        console.warn("⚠️ File not found:", key);
        return response(404, { success: false, message: "File not found in S3" });
      }
      throw err; // rethrow unexpected errors
    }

    const contentType = head.ContentType || "application/octet-stream";
    const expiresIn = 60 * 60 * 6; // 6 hours
    const filename = key.split("/").pop();

    /* ============================================================
       🔐 Generate presigned GET URL
    ============================================================= */
    const params = {
      Bucket: BUCKET,
      Key: key,
      Expires: expiresIn,
      ResponseCacheControl: "no-cache",
      ResponseContentType: contentType,
      ResponseContentDisposition: `inline; filename="${filename}"`,
    };

    const viewURL = await s3.getSignedUrlPromise("getObject", params);

    console.log("✅ Presigned download URL generated successfully.");

    return response(200, {
      success: true,
      message: "Presigned download URL generated successfully",
      viewURL,
      expiresInSeconds: expiresIn,
      filename,
      contentType,
    });
  } catch (err) {
    console.error("❌ PRESIGN DOWNLOAD ERROR:", err);

    const safeMessage =
      err.code === "AccessDenied"
        ? "Access denied to file"
        : err.code === "CredentialsError"
        ? "Server configuration issue (missing S3 credentials)"
        : err.message || "Failed to generate download URL";

    return response(500, { success: false, message: safeMessage });
  }
};
