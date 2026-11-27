import fs from 'fs';
import path from 'path';

test('osls', () => {
  const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/osls/.serverless');

  const cloudformation = require(path.join(testArtifactPath, 'cloudformation-template-update-stack.json'));

  expect(cloudformation.Resources.ValidateIsinLambdaFunction.Properties.Code.S3Key).toContain('osls-example.zip');

  const indexContents = fs.readFileSync(path.join(testArtifactPath, 'index.js')).toString();

  // bundled by esbuild: the dependency is inlined rather than required at runtime
  expect(indexContents).not.toMatch(/require\(["']isin-validator["']\)/);
  expect(indexContents).toContain('exports');
});
