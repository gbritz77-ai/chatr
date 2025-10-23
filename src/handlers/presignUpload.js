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
  console.log("📤 PRESIGN EVENT:", JSON.stringify(event, null, 2));

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : {};
    const { name, type } = body;

    if (!name || !type)
      return response(400, { success: false, message: "Missing file name or type" });

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    const params = {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300,
      ACL: "public-read", // ✅ critical
    };

    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    const region = process.env.AWS_REGION || "eu-west-2";
    const publicUrl = `https://${BUCKET}.s3.${region}.amazonaws.com/${fileKey}`;

    return response(200, { success: true, uploadURL, fileKey, publicUrl });
  } catch (err) {
    console.error("❌ PRESIGN ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
