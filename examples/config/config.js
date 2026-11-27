module.exports = () => {
  return {
    packager: 'pnpm',
    bundle: true,
    minify: true,
    sourcemap: false,
    keepNames: true,
    external: ['lodash'],
    plugins: [
      {
        name: 'log-lodash',
        setup(build) {
          // test interception : log all lodash imports
          build.onResolve({ filter: /^lodash$/ }, (args) => {
            console.log(args);
          });
        },
      },
    ],
  };
};
