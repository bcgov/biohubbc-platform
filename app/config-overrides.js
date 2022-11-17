module.exports = {
  webpack: function (config, env) {
    config.resolve.fallback = {
      assert: require.resolve('assert'),
      constants: require.resolve('fs-constants'),
      fs: require.resolve('fs-extra'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify')
    };

    // Hide sourcemap (development) warnings in app console log
    config.ignoreWarnings = [/Failed to parse source map/, /autoprefixer/];

    return config;
  }
};
