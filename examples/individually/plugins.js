let envPlugin = {
  name: 'log-lodash',
  setup(build) {
    // test interception : log all lodash imports
    build.onResolve({ filter: /^lodash$/ }, (args) => {
      console.log(args);
    });
  },
};

// default export should be an array of plugins
module.exports = [envPlugin];
