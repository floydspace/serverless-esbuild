import fs from 'fs';
import path from 'path';

test('complete', () => {
  const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/complete/.serverless');

  const cloudformation = require(path.join(testArtifactPath, 'cloudformation-template-update-stack.json'));

  const indexContents = fs.readFileSync(path.join(testArtifactPath, 'src/index.js')).toString();

  expect(indexContents).toMatchSnapshot();

  const nodeModules = fs.readdirSync(path.join(testArtifactPath, 'node_modules')).toString();

  expect(nodeModules).toEqual(expect.stringContaining('isin-validator'));

  // package.json is excluded by default, but kept when listed in package.patterns
  const packageJson = JSON.parse(fs.readFileSync(path.join(testArtifactPath, 'package.json')).toString());

  expect(packageJson.name).toBe('complete');

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

  const validateIsinLambdaVersionPropertyKey = cloudformation.Outputs.ValidateIsinLambdaFunctionQualifiedArn.Value
    .Ref as keyof typeof cloudformation.Resources;

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
