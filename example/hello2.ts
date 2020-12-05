
// modern module syntax
export async function handler(event, context, callback) {
  // async/await also works out of the box
  await new Promise((resolve) => setTimeout(resolve, 500));

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  };

  callback(null, response);
}
