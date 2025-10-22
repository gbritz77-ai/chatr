const success = (data) => ({
  statusCode: 200,
  body: JSON.stringify({ success: true, data }),
});

const failure = (err, statusCode = 400) => ({
  statusCode,
  body: JSON.stringify({
    success: false,
    message: err.message || err.toString() || 'Error',
  }),
});

module.exports = { success, failure };
