const validateIsin = require('isin-validator');

module.exports.handler = (event, context, callback) => {
  const isInvalid = validateIsin(event.pathParameters.isin);

  callback(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: isInvalid ? 'ISIN is invalid!' : 'ISIN is fine!',
      input: event,
    }),
  });
};
