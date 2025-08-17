module.exports = function override(config, env) {
    config.resolve.fallback = {
        ...config.resolve.fallback,
        "fs": false,
        "path": require.resolve("path-browserify"),
        "util": false,
        "crypto": false,
        "stream": false,
        "buffer": false,
        "process": false,
        "zlib": false,
        "querystring": false,
    };

    return config;
};
