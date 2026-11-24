import fs from 'fs';
import path from 'path';

const testArtifactPath = path.resolve(__dirname, '../.test-artifacts/async-config');

test('async config', () => {
  // options returned by the async factory are applied, not the defaults
  expect(fs.existsSync(path.join(testArtifactPath, '.esbuild', 'custom-build', 'handler.js'))).toBe(true);
  expect(fs.existsSync(path.join(testArtifactPath, '.esbuild', '.build'))).toBe(false);

  const handlerContents = fs.readFileSync(path.join(testArtifactPath, '.serverless', 'handler.js')).toString();

  expect(handlerContents).toContain('hello from async config');
});
