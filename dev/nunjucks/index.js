const appendAssetHash = require('./../common/appendAssetHash');

module.exports = function(env) {
    env.addGlobal('asset', appendAssetHash);
};
