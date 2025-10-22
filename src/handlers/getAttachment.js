import AWS from "aws-sdk";

const s3 = new AWS.S3();

export const handler = async (event) => {
  console.log("📎 GET ATTACHMENT EVENT:", event);

  try {
    const key = event.queryStringParameters?.key;
    if (!key) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, message: "Missing key" }),
      };
    }

    const params = {
      Bucket: process.env.ATTACHMENTS_BUCKET,
      Key: key,
      Expires: 3600, // 1 hour
    };

    const signedUrl = s3.getSignedUrl("getObject", params);
    console.log("✅ Redirecting to:", signedUrl);

    return {
      statusCode: 302,
      headers: {
        Location: signedUrl,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
    };
  } catch (err) {
    console.error("❌ Attachment download failed:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        message: "Failed to generate download link",
        error: err.message,
      }),
    };
  }
};
