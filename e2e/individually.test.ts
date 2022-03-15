import fs from 'fs';

test('individually', () => {
  const hello1indexContents = fs.readFileSync('e2e-individually/.serverless/hello1.js').toString();
  const hello2indexContents = fs.readFileSync('e2e-individually/.serverless/hello2.js').toString();
  expect(hello1indexContents).toMatchSnapshot();
  expect(hello2indexContents).toMatchSnapshot();
});
