module.exports = async () => {
  // resolve on a later tick so the plugin has to await the factory
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    outputBuildFolder: 'custom-build',
    keepOutputDirectory: true,
    minify: false,
    define: { MESSAGE: JSON.stringify('hello from async config') },
  };
};
