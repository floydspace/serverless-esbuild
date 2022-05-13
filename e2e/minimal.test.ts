import fs from 'fs';
import cloudformation from './minimal/.serverless/cloudformation-template-update-stack.json';

test('minimal', () => {
  const indexContents = fs.readFileSync('e2e/minimal/.serverless/index.js').toString();
  expect(indexContents).toMatchSnapshot();

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();
  expect(cloudformation.Description).toMatchSnapshot;
  expect(cloudformation.Outputs).toMatchSnapshot();

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
  });

  expect(apiGatewayDeployment).toMatchSnapshot();
});
