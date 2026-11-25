import fs from 'fs';
import path from 'path';

test('exclude', () => {
  const nodeModules = path.resolve(__dirname, '../.test-artifacts/exclude/.serverless/node_modules');

  expect(fs.existsSync(path.join(nodeModules, 'dynamodb-doc', 'package.json'))).toBe(true);
  // excluded by default, even though it is only a dependency of dynamodb-doc
  expect(fs.existsSync(path.join(nodeModules, 'aws-sdk'))).toBe(false);
});
