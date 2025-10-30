import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.GROUPS_TABLE || "chatr-groups";

/* ============================================================
   🧰 Response Helper
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🧠 Main Handler
============================================================ */
export const handler = async (event) => {
  console.log("👥 GROUPS EVENT:", JSON.stringify(event, null, 2));
  const method = event.httpMethod || "GET";
  const path = event.path || "";
  const params = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  if (method === "OPTIONS") return response(200, { message: "CORS preflight success" });

  try {
    /* ============================================================
       📜 GET /groups?username=...
       → List all groups the user belongs to
    ============================================================= */
    if (method === "GET") {
      const username = params.username;
      if (!username) return response(400, { success: false, message: "Missing username" });

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "contains(members, :u)",
          ExpressionAttributeValues: { ":u": username },
        })
        .promise();

      return response(200, { success: true, groups: result.Items || [] });
    }

    /* ============================================================
       🆕 POST /groups → Create Group
    ============================================================= */
    if (method === "POST") {
      const { groupName, creator, members } = body;
      if (!groupName || !creator || !members)
        return response(400, { success: false, message: "Missing groupName, creator, or members" });

      const groupid = `${creator}-${Date.now()}`;
      const newGroup = {
        groupid,
        groupName,
        creator,
        members: Array.from(new Set(members)),
        createdAt: new Date().toISOString(),
      };

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: newGroup,
        })
        .promise();

      return response(200, { success: true, group: newGroup });
    }

    /* ============================================================
       ➕ PUT /groups/add → Add Member to Group
    ============================================================= */
    if (method === "PUT" && path.endsWith("/add")) {
      const { groupid, username, requester } = body;
      if (!groupid || !username || !requester)
        return response(400, { success: false, message: "Missing groupid, username, or requester" });

      const groupRes = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();
      const group = groupRes.Item;

      if (!group) return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, { success: false, message: "Only group creator can add members" });

      if (group.members.includes(username))
        return response(200, { success: true, message: "User already in group", group });

      group.members.push(username);

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { groupid },
          UpdateExpression: "SET members = :m",
          ExpressionAttributeValues: { ":m": group.members },
        })
        .promise();

      return response(200, { success: true, message: "Member added", group });
    }

    /* ============================================================
       ➖ PUT /groups/remove → Remove Member
    ============================================================= */
    if (method === "PUT" && path.endsWith("/remove")) {
      const { groupid, username, requester } = body;
      if (!groupid || !username || !requester)
        return response(400, { success: false, message: "Missing groupid, username, or requester" });

      const groupRes = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();
      const group = groupRes.Item;

      if (!group) return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, { success: false, message: "Only group creator can remove members" });

      const updatedMembers = group.members.filter((m) => m !== username);

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { groupid },
          UpdateExpression: "SET members = :m",
          ExpressionAttributeValues: { ":m": updatedMembers },
        })
        .promise();

      return response(200, { success: true, message: "Member removed", groupid, members: updatedMembers });
    }

    /* ============================================================
       🗑️ DELETE /groups/delete → Delete Group
    ============================================================= */
    if (method === "DELETE" && path.endsWith("/delete")) {
      const { groupid, requester } = body;
      if (!groupid || !requester)
        return response(400, { success: false, message: "Missing groupid or requester" });

      const groupRes = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();
      const group = groupRes.Item;

      if (!group) return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, { success: false, message: "Only group creator can delete the group" });

      await dynamodb
        .delete({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();

      return response(200, { success: true, message: "Group deleted" });
    }

    return response(405, { success: false, message: "Unsupported operation" });
  } catch (err) {
    console.error("❌ GROUPS HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
