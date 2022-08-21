import fs from 'fs';
import path from 'path';

test('individually', () => {
  const cloudformation = JSON.parse(
    fs
      .readFileSync(
        path.join(__dirname, 'individually/.serverless/cloudformation-template-update-stack.json')
      )
      .toString()
  );
  const hello1indexContents = fs
    .readFileSync(path.join(__dirname, 'individually/.serverless/hello1.js'))
    .toString();
  const hello2indexContents = fs
    .readFileSync(path.join(__dirname, 'individually/.serverless/hello2.js'))
    .toString();

  expect(hello1indexContents).toMatchSnapshot();

  expect(hello2indexContents).toMatchSnapshot();

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();

  expect(cloudformation.Description).toMatchSnapshot;

  expect(cloudformation.Outputs).toMatchSnapshot();

  const apiGatewayDeploymentPropertyKey = Object.keys(cloudformation.Resources).find((s) =>
    s.startsWith('ApiGatewayDeployment')
  ) as keyof typeof cloudformation.Resources;

  const { [apiGatewayDeploymentPropertyKey]: apiGatewayDeployment, ...deterministicResources } =
    cloudformation.Resources;

  expect(deterministicResources).toMatchSnapshot({
    Hello1LambdaFunction: {
      Properties: {
        Code: { S3Key: expect.stringContaining('hello1.zip') },
      },
    },
    Hello2LambdaFunction: {
      Properties: {
        Code: { S3Key: expect.stringContaining('hello2.zip') },
      },
    },
  });

  expect(apiGatewayDeployment).toMatchSnapshot();
});
