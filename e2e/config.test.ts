import fs from 'fs';
import path from 'path';

test('config', () => {
  const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/config/.serverless');

  for (const handler of ['hello1.js', 'hello2.js']) {
    const contents = fs.readFileSync(path.join(testArtifactPath, handler)).toString();

    // `minify: true` from config.js
    expect(contents.trim().split('\n')).toHaveLength(1);
  }

  // `external: ['lodash']` from config.js: lodash is required at runtime instead of being bundled
  const hello1Contents = fs.readFileSync(path.join(testArtifactPath, 'hello1.js')).toString();
  expect(hello1Contents).toContain('require("lodash")');
  expect(fs.existsSync(path.join(testArtifactPath, 'node_modules', 'lodash', 'package.json'))).toBe(true);
});
