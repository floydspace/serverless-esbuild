import execa from 'execa';
import fetch from 'node-fetch';
import tcp from 'tcp-port-used';

const testPort = 3000; //Default sls-offline port
const testUrl = ({ env = 'dev', path }) =>
  `http://localhost:${testPort}/${env}/${path}`;

beforeAll(async () => {
  console.log('Booting up sls offline...');
  await execa('yarn', ['offline:start']);
  await tcp.waitUntilUsed(3000, 500, 5000);
  console.log('Port ready!');
});

afterAll(async () => {
  console.log('Tearing down sls offline...');
  await execa('yarn', ['offline:stop']);
});

test('I can call the hello handler', async () => {
  const { message } = await fetch(testUrl({ path: 'hello' })).then((r) =>
    r.json()
  );
  expect(message).toBe(
    'Go Serverless v1.0! Your function executed successfully!'
  );
});
