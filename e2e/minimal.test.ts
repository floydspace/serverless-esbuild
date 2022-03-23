import fs from 'fs';
import cloudformation from './minimal/.serverless/cloudformation-template-update-stack.json';

test('minimal', () => {
  const indexContents = fs.readFileSync('e2e/minimal/.serverless/index.js').toString();
  expect(indexContents).toMatchSnapshot();
  expect(cloudformation).toMatchObject({
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'The AWS CloudFormation template for this Serverless application',
    Resources: {
      ServerlessDeploymentBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              {
                ServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256',
                },
              },
            ],
          },
        },
      },
      ServerlessDeploymentBucketPolicy: {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          Bucket: {
            Ref: 'ServerlessDeploymentBucket',
          },
          PolicyDocument: {
            Statement: [
              {
                Action: 's3:*',
                Effect: 'Deny',
                Principal: '*',
                Resource: [
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                        {
                          Ref: 'ServerlessDeploymentBucket',
                        },
                        '/*',
                      ],
                    ],
                  },
                  {
                    'Fn::Join': [
                      '',
                      [
                        'arn:',
                        {
                          Ref: 'AWS::Partition',
                        },
                        ':s3:::',
                        {
                          Ref: 'ServerlessDeploymentBucket',
                        },
                      ],
                    ],
                  },
                ],
                Condition: {
                  Bool: {
                    'aws:SecureTransport': false,
                  },
                },
              },
            ],
          },
        },
      },
      ValidateIsinLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
          LogGroupName: '/aws/lambda/minimal-example-dev-validateIsin',
        },
      },
      IamRoleLambdaExecution: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: {
                  Service: ['lambda.amazonaws.com'],
                },
                Action: ['sts:AssumeRole'],
              },
            ],
          },
          Policies: [
            {
              PolicyName: {
                'Fn::Join': ['-', ['minimal-example', 'dev', 'lambda']],
              },
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: ['logs:CreateLogStream', 'logs:CreateLogGroup'],
                    Resource: [
                      {
                        'Fn::Sub':
                          'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/minimal-example-dev*:*',
                      },
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: ['logs:PutLogEvents'],
                    Resource: [
                      {
                        'Fn::Sub':
                          'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/minimal-example-dev*:*:*',
                      },
                    ],
                  },
                ],
              },
            },
          ],
          Path: '/',
          RoleName: {
            'Fn::Join': [
              '-',
              [
                'minimal-example',
                'dev',
                {
                  Ref: 'AWS::Region',
                },
                'lambdaRole',
              ],
            ],
          },
        },
      },
      ValidateIsinLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Code: {
            S3Bucket: {
              Ref: 'ServerlessDeploymentBucket',
            },
            S3Key: expect.stringContaining('/minimal-example.zip'),
          },
          Handler: 'index.handler',
          Runtime: 'nodejs12.x',
          FunctionName: 'minimal-example-dev-validateIsin',
          MemorySize: 1024,
          Timeout: 6,
          Role: {
            'Fn::GetAtt': ['IamRoleLambdaExecution', 'Arn'],
          },
        },
        DependsOn: ['ValidateIsinLogGroup'],
      },
      ApiGatewayRestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: 'dev-minimal-example',
          EndpointConfiguration: {
            Types: ['EDGE'],
          },
          Policy: '',
        },
      },
      ApiGatewayResourceValidateDashisin: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: {
            'Fn::GetAtt': ['ApiGatewayRestApi', 'RootResourceId'],
          },
          PathPart: 'validate-isin',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
        },
      },
      ApiGatewayResourceValidateDashisinIsinVar: {
        Type: 'AWS::ApiGateway::Resource',
        Properties: {
          ParentId: {
            Ref: 'ApiGatewayResourceValidateDashisin',
          },
          PathPart: '{isin}',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
        },
      },
      ApiGatewayMethodValidateDashisinIsinVarGet: {
        Type: 'AWS::ApiGateway::Method',
        Properties: {
          HttpMethod: 'GET',
          RequestParameters: {},
          ResourceId: {
            Ref: 'ApiGatewayResourceValidateDashisinIsinVar',
          },
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
          ApiKeyRequired: false,
          AuthorizationType: 'NONE',
          Integration: {
            IntegrationHttpMethod: 'POST',
            Type: 'AWS_PROXY',
            Uri: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  {
                    Ref: 'AWS::Partition',
                  },
                  ':apigateway:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':lambda:path/2015-03-31/functions/',
                  {
                    'Fn::GetAtt': ['ValidateIsinLambdaFunction', 'Arn'],
                  },
                  '/invocations',
                ],
              ],
            },
          },
          MethodResponses: [],
        },
        DependsOn: ['ValidateIsinLambdaPermissionApiGateway'],
      },
      ValidateIsinLambdaPermissionApiGateway: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: {
            'Fn::GetAtt': ['ValidateIsinLambdaFunction', 'Arn'],
          },
          Action: 'lambda:InvokeFunction',
          Principal: 'apigateway.amazonaws.com',
          SourceArn: {
            'Fn::Join': [
              '',
              [
                'arn:',
                {
                  Ref: 'AWS::Partition',
                },
                ':execute-api:',
                {
                  Ref: 'AWS::Region',
                },
                ':',
                {
                  Ref: 'AWS::AccountId',
                },
                ':',
                {
                  Ref: 'ApiGatewayRestApi',
                },
                '/*/*',
              ],
            ],
          },
        },
      },
    },
    Outputs: {
      ServerlessDeploymentBucketName: {
        Value: {
          Ref: 'ServerlessDeploymentBucket',
        },
        Export: {
          Name: 'sls-minimal-example-dev-ServerlessDeploymentBucketName',
        },
      },
      ValidateIsinLambdaFunctionQualifiedArn: {
        Description: 'Current Lambda function version',
        Value: {
          Ref: expect.stringContaining('ValidateIsinLambdaVersion'),
        },
        Export: {
          Name: 'sls-minimal-example-dev-ValidateIsinLambdaFunctionQualifiedArn',
        },
      },
      ServiceEndpoint: {
        Description: 'URL of the service endpoint',
        Value: {
          'Fn::Join': [
            '',
            [
              'https://',
              {
                Ref: 'ApiGatewayRestApi',
              },
              '.execute-api.',
              {
                Ref: 'AWS::Region',
              },
              '.',
              {
                Ref: 'AWS::URLSuffix',
              },
              '/dev',
            ],
          ],
        },
        Export: {
          Name: 'sls-minimal-example-dev-ServiceEndpoint',
        },
      },
    },
  });
});
