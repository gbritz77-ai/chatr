const AWS = require("aws-sdk");

AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET = process.env.ATTACHMENTS_BUCKET;

/* ============================================================
   🔧 Helper: Standardized HTTP Response
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   📦 Handler: Generate Presigned GET URL for Attachments
============================================================ */
exports.handler = async (event) => {
  console.log("📥 PRESIGN-DOWNLOAD EVENT:", JSON.stringify(event, null, 2));

  try {
    // Handle both JSON and already-parsed event bodies
    const body =
      typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

    const key = body.key || body.fileKey || null;
    if (!key) {
      console.warn("⚠️ Missing key in request body.");
      return response(400, { success: false, message: "Missing file key" });
    }

    console.log(`🪣 Generating presigned download URL for ${BUCKET}/${key}`);

    // Generate presigned URL (GET)
    const params = {
      Bucket: BUCKET,
      Key: key,
      Expires: 86400, // 24 hours
      ResponseCacheControl: "no-cache",
      ResponseContentDisposition: `inline; filename="${key.split("/").pop()}"`,
    };

    const viewURL = await s3.getSignedUrlPromise("getObject", params);

    console.log("✅ Presigned download URL generated successfully");
    return response(200, {
      success: true,
      viewURL,
      expiresIn: 86400,
    });
  } catch (err) {
    console.error("❌ PRESIGN-DOWNLOAD ERROR:", err);
    return response(500, {
      success: false,
      message: "Failed to generate download URL",
      error: err.message,
    });
  }
};
