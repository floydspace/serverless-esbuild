import fs from 'fs';
import cloudformation from './.test-artifacts/minimal/.serverless/cloudformation-template-update-stack.json';

test('minimal', () => {
  const indexContents = fs.readFileSync('e2e/.test-artifacts/minimal/.serverless/index.js').toString();
  expect(indexContents).toMatchSnapshot();

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();
  expect(cloudformation.Description).toMatchSnapshot;
  expect(cloudformation.Outputs).toMatchSnapshot({
    ValidateIsinLambdaFunctionQualifiedArn: {
      Value: { Ref: expect.any(String) },
    },
  });
  expect(cloudformation.Outputs.ValidateIsinLambdaFunctionQualifiedArn.Value.Ref).toMatch(/^ValidateIsinLambdaVersion/);

  const apiGatewayDeploymentPropertyKey = Object.keys(cloudformation.Resources).find((s) =>
    s.startsWith('ApiGatewayDeployment')
  ) as keyof typeof cloudformation.Resources;

  const { [apiGatewayDeploymentPropertyKey]: apiGatewayDeployment, ...deterministicResources } =
    cloudformation.Resources;

  expect(deterministicResources).toMatchSnapshot({
    ValidateIsinLambdaFunction: {
      Properties: {
        Code: { S3Key: expect.stringContaining('minimal-example.zip') },
      },
    },
    [Object.keys(deterministicResources).find((s) => s.startsWith('ValidateIsinLambdaVersion')) as string]: {
      Properties: { CodeSha256: expect.any(String) },
    },
  });

  expect(apiGatewayDeployment).toMatchSnapshot();
});
