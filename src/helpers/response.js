// src/helpers/response.js
export const response = (statusCode, body = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // ✅ Allow both Amplify & localhost
    "Access-Control-Allow-Origin": "*",
    // ✅ Include all common AWS + browser headers
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    // ✅ Ensure all REST verbs are allowed
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE,PATCH",
  },
  body: JSON.stringify(body),
});
