import fs from 'fs';

test('complete', () => {
  const indexContents = fs.readFileSync('e2e/complete/.serverless/src/index.js').toString();
  expect(indexContents).toMatchSnapshot();
  const nodeModules = fs.readdirSync('e2e/complete/.serverless/node_modules').toString();
  expect(nodeModules).toMatchSnapshot();
});
