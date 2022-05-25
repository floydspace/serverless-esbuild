const rootConfig = require('./jest.config');

const config = { ...rootConfig, rootDir: 'e2e' };

module.exports = config;
