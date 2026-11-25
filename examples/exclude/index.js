const AWS = require('dynamodb-doc');

module.exports.handler = async () => ({ statusCode: 200, body: typeof AWS });
