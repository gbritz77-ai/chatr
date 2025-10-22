const AWS = require('aws-sdk');

const db = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

async function put(table, item) {
  await db.put({ TableName: table, Item: item }).promise();
  return item;
}

async function getAll(table) {
  const result = await db.scan({ TableName: table }).promise();
  return result.Items || [];
}

module.exports = { put, getAll };
