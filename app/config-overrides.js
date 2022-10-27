module.exports = {
  webpack: function (config, env) {
    config.resolve.fallback = {
      assert: require.resolve('assert'),
      // buffer: require.resolve('buffer'),
      constants: require.resolve('fs-constants'),
      fs: require.resolve('fs-extra'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify')
    };

    // Hide sourcemap (development) warnings in app console log
    config.ignoreWarnings = [/Failed to parse source map/, /autoprefixer/];

    //   config.plugins.push(
    //     new webpack.ProvidePlugin({
    //       process: 'process/browser',
    //       Buffer: ['buffer', 'Buffer']
    //     })
    //   );

    return config;
  }
};
