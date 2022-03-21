import fs from 'fs';

test('minimal', () => {
  const indexContents = fs.readFileSync('e2e/minimal/.serverless/index.js').toString();
  expect(indexContents).toMatchSnapshot();
});
