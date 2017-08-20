const appendAssetHash = require('./../common/appendAssetHash');

module.exports = function(sass) {
    const functions = {};

    functions['asset($url)'] = (rawUrl) => {
        const newUrl = appendAssetHash(rawUrl.getValue());
        return sass.types.String(newUrl);
    };

    return functions;
};
