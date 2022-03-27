import fs from 'fs';
import cloudformation from './complete/.serverless/cloudformation-template-update-stack.json';

test('complete', () => {
  const indexContents = fs.readFileSync('e2e/complete/.serverless/src/index.js').toString();
  expect(indexContents).toMatchSnapshot();

  const nodeModules = fs.readdirSync('e2e/complete/.serverless/node_modules').toString();
  expect(nodeModules).toEqual(expect.stringContaining('isin-validator'));

  expect(cloudformation.AWSTemplateFormatVersion).toMatchSnapshot();
  expect(cloudformation.Description).toMatchSnapshot;
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
  expect(validateIsinLambdaVersion).toMatchSnapshot();
});
