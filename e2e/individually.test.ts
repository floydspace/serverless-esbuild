import fs from 'fs';
import path from 'path';

test('individually', () => {
  const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/individually/.serverless');

  const cloudformation = require(path.join(testArtifactPath, 'cloudformation-template-update-stack.json'));

  const hello1indexContents = fs.readFileSync(path.join(testArtifactPath, 'hello1.js')).toString();
  const hello2indexContents = fs.readFileSync(path.join(testArtifactPath, 'hello2.js')).toString();

  expect(hello1indexContents).toMatchSnapshot();

  expect(hello2indexContents).toMatchSnapshot();

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();

  expect(cloudformation.Description).toMatchSnapshot();

  expect(cloudformation.Outputs).toMatchSnapshot({
    Hello1LambdaFunctionQualifiedArn: {
      Value: { Ref: expect.any(String) },
    },
    Hello2LambdaFunctionQualifiedArn: {
      Value: { Ref: expect.any(String) },
    },
  });

  expect(cloudformation.Outputs.Hello1LambdaFunctionQualifiedArn.Value.Ref).toMatch(/^Hello1LambdaVersion/);

  expect(cloudformation.Outputs.Hello2LambdaFunctionQualifiedArn.Value.Ref).toMatch(/^Hello2LambdaVersion/);

  const apiGatewayDeploymentPropertyKey = Object.keys(cloudformation.Resources).find((s) =>
    s.startsWith('ApiGatewayDeployment')
  ) as keyof typeof cloudformation.Resources;

  const hello1LambdaVersionPropertyKey = cloudformation.Outputs.Hello1LambdaFunctionQualifiedArn.Value
    .Ref as keyof typeof cloudformation.Resources;

  const hello2LambdaVersionPropertyKey = cloudformation.Outputs.Hello2LambdaFunctionQualifiedArn.Value
    .Ref as keyof typeof cloudformation.Resources;

  const {
    [apiGatewayDeploymentPropertyKey]: apiGatewayDeployment,
    [hello1LambdaVersionPropertyKey]: hello1LambdaVersion,
    [hello2LambdaVersionPropertyKey]: hello2LambdaVersion,
    ...deterministicResources
  } = cloudformation.Resources;

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
  expect(hello1LambdaVersion).toMatchSnapshot({
    Properties: { CodeSha256: expect.any(String) },
  });
  expect(hello2LambdaVersion).toMatchSnapshot({
    Properties: { CodeSha256: expect.any(String) },
  });
});
