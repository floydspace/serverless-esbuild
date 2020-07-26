import execa from 'execa';
import fetch from 'node-fetch';
import tcp from 'tcp-port-used';

const testPort = 3000;

const testUrl = ({ env = 'dev', port = testPort, path }) =>
  `http://localhost:${port}/${env}/${path}`;

const waitForPort = async ({ port = 3002, timeout }) => {
  try {
    await tcp.waitUntilUsed(port, 500, timeout);
    console.log(`Port ${port} is ready.`);
    return true;
  } catch (error) {
    console.log(`Something went wrong with port ${port}... ${error.message}`);
  }
};

beforeAll(async () => {
  const timeout = 15000;
  console.log('Booting up sls offline...');
  await execa('yarn', ['offline:start']);
  await waitForPort({ timeout });
  await waitForPort({ port: testPort, timeout });
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
