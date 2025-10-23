const AWS = require("aws-sdk");
const crypto = require("crypto");

AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET = process.env.ATTACHMENTS_BUCKET;

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

module.exports.handler = async (event) => {
  console.log("📤 PRESIGN EVENT RAW:", JSON.stringify(event, null, 2));

  try {
    // Parse and validate request
    const body = typeof event.body === "string" ? JSON.parse(event.body) : {};
    const { name, type } = body;

    if (!name || !type) {
      console.warn("⚠️ Missing name/type:", body);
      return response(400, { success: false, message: "Missing file name or type" });
    }

    if (!BUCKET) {
      console.error("❌ Missing ATTACHMENTS_BUCKET env var");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    // Sanitize filename
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    // ✅ Only use ACL for public files that should be viewable directly
    const isPublic = /\.(png|jpe?g|gif|webp|pdf)$/i.test(safeName);
    const acl = isPublic ? "public-read" : undefined;

    const params = {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300, // 5 minutes
    };

    if (acl) params.ACL = acl;

    console.log("🧾 PRESIGN PARAMS:", JSON.stringify(params, null, 2));

    // Generate presigned URL
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);

    const region = process.env.AWS_REGION || "eu-west-2";
    const publicUrl = `https://${BUCKET}.s3.${region}.amazonaws.com/${fileKey}`;

    console.log("✅ PRESIGN SUCCESS", {
      uploadURLPreview: uploadURL.split("?")[0],
      acl: acl || "default (private)",
      region,
      bucket: BUCKET,
      fileKey,
      fileType: type,
      publicUrl,
    });

    return response(200, {
      success: true,
      uploadURL,
      fileKey,
      acl: acl || "private",
      publicUrl,
      debug: {
        bucket: BUCKET,
        region,
        contentType: type,
      },
    });
  } catch (err) {
    console.error("❌ PRESIGN ERROR STACK:", err.stack || err);
    return response(500, {
      success: false,
      message: err.message || "Presign failed",
      stack: err.stack,
    });
  }
};
