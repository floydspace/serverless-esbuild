/* global MESSAGE -- replaced at build time by the esbuild `define` in config.js */

module.exports.handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ message: MESSAGE }),
});
