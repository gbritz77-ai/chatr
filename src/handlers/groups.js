// src/handlers/groups.js
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.GROUPS_TABLE || "chatr-groups";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("📩 GROUPS EVENT:", JSON.stringify(event, null, 2));

  try {
    const method = event.httpMethod;

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { groupname, members } = body;

      if (!groupname || !Array.isArray(members) || members.length < 2) {
        return response(400, { success: false, message: "Invalid group data" });
      }

      const group = {
        groupid: `grp-${Date.now()}`,
        groupname,
        members,
        createdAt: new Date().toISOString(),
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: group }).promise();
      return response(200, { success: true, data: group });
    }

    if (method === "GET") {
      const username = event.queryStringParameters?.username;
      if (!username)
        return response(400, { success: false, message: "Username required" });

      const res = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      const visibleGroups =
        res.Items?.filter((g) => g.members?.includes(username)) || [];

      return response(200, { success: true, data: visibleGroups });
    }

    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ GROUPS HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
