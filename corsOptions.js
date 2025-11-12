// ✅ src/handlers/corsOptions.js
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://dev.d3rrkqgvvakfxn.amplifyapp.com",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,PATCH,DELETE",
      "Access-Control-Allow-Headers":
        "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    },
    body: JSON.stringify({ success: true, message: "CORS OK" }),
  };
};
