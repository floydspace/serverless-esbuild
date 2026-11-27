import fs from 'fs';
import path from 'path';

test('no-functions', () => {
  const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/no-functions');

  // `sls package` succeeds and still produces the CloudFormation template
  expect(fs.existsSync(path.join(testArtifactPath, '.serverless', 'cloudformation-template-update-stack.json'))).toBe(
    true
  );

  // nothing was bundled, so there are no zips and the plugin's work folder is cleaned up
  expect(fs.readdirSync(path.join(testArtifactPath, '.serverless')).filter((file) => file.endsWith('.zip'))).toEqual(
    []
  );
  expect(fs.existsSync(path.join(testArtifactPath, '.esbuild'))).toBe(false);
});
