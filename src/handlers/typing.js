const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TYPING_TABLE || "chatr-typing-status";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("⌨️ Typing event:", event);
  const method = event.httpMethod;
  const path = event.path || "";
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    if (method === "OPTIONS") return response(200, {});

    /* ======================================================
       🟢 POST /typing/start
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/start")) {
      const { username, chatid } = body;
      if (!username || !chatid)
        return response(400, { success: false, message: "Missing fields" });

      const item = {
        chatid,
        username,
        typing: true,
        updatedAt: new Date().toISOString(),
      };

      await dynamodb
        .put({ TableName: TABLE_NAME, Item: item })
        .promise();

      return response(200, { success: true, message: "Typing started" });
    }

    /* ======================================================
       🔴 POST /typing/stop
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/stop")) {
      const { username, chatid } = body;
      if (!username || !chatid)
        return response(400, { success: false, message: "Missing fields" });

      await dynamodb
        .delete({
          TableName: TABLE_NAME,
          Key: { chatid, username },
        })
        .promise();

      return response(200, { success: true, message: "Typing stopped" });
    }

    /* ======================================================
       👀 GET /typing?chatid=
       Returns all users typing in a chat
    ====================================================== */
    if (method === "GET" && path.endsWith("/typing") && event.queryStringParameters?.chatid) {
      const { chatid } = event.queryStringParameters;

      const result = await dynamodb
        .scan({ TableName: TABLE_NAME })
        .promise();

      const usersTyping =
        result.Items?.filter((x) => x.chatid === chatid)?.map((x) => x.username) || [];

      return response(200, { success: true, usersTyping });
    }

    return response(404, { success: false, message: "Invalid route" });
  } catch (err) {
    console.error("❌ typing handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
