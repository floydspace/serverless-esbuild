import fs from 'fs';
import path from 'path';

test('complete', () => {
  const cloudformation = JSON.parse(
    fs
      .readFileSync(
        path.join(__dirname, 'complete/.serverless/cloudformation-template-update-stack.json')
      )
      .toString()
  );

  const indexContents = fs
    .readFileSync(path.join(__dirname, 'complete/.serverless/src/index.js'))
    .toString();

  expect(indexContents).toMatchSnapshot();

  const nodeModules = fs.readdirSync('e2e/complete/.serverless/node_modules').toString();

  expect(nodeModules).toEqual(expect.stringContaining('isin-validator'));

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();

  expect(cloudformation.Description).toMatchSnapshot();

  expect(cloudformation.Outputs).toMatchSnapshot({
    ValidateIsinLambdaFunctionQualifiedArn: {
      Value: {
        Ref: expect.stringContaining('ValidateIsinLambdaVersion'),
      },
    },
  });

  const apiGatewayDeploymentPropertyKey = Object.keys(cloudformation.Resources).find((s) =>
    s.startsWith('ApiGatewayDeployment')
  ) as keyof typeof cloudformation.Resources;

  const validateIsinLambdaVersionPropertyKey = cloudformation.Outputs
    .ValidateIsinLambdaFunctionQualifiedArn.Value.Ref as keyof typeof cloudformation.Resources;

  const {
    [apiGatewayDeploymentPropertyKey]: apiGatewayDeployment,
    [validateIsinLambdaVersionPropertyKey]: validateIsinLambdaVersion,
    ...deterministicResources
  } = cloudformation.Resources;

  expect(deterministicResources).toMatchSnapshot({
    ValidateIsinLambdaFunction: {
      Properties: {
        Code: { S3Key: expect.stringContaining('complete-example.zip') },
      },
    },
  });

  expect(apiGatewayDeployment).toMatchSnapshot();

  expect(validateIsinLambdaVersion).toMatchSnapshot({
    Properties: {
      CodeSha256: expect.any(String),
    },
  });
});
