const CRC32 = require('crc-32');
const fs = require('fs');
const path = require('path');

const isProduction = require('gulp-environment').production;
const HASH_DICTIONARY = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

const hashCache = {};

function appendAssetHash(url) {
    if (!isProduction) {
        return url;
    }

    const filePath = path.join(__dirname, '../../dist', url);
    let hash       = hashCache[url];
    if (hash == null && fs.existsSync(filePath)) {
        const file = fs.readFileSync(filePath);

        // Get basic hash
        const hashRaw = (typeof file === 'string') ? CRC32.str(file) : CRC32.buf(file);
        let i         = (hashRaw >>> 0);

        // Compress hash
        hash = '';
        if (i === 0) {
            hash = HASH_DICTIONARY[0];
        } else {
            const base = HASH_DICTIONARY.length;
            while (i > 0) {
                hash += HASH_DICTIONARY[i % base];
                i = Math.floor(i / base);
            }
        }

        // Obfuscate hash
        hash = hash.split().reverse().join('');
        hashCache[url] = hash;
    }

    if (hash != null) {
        url += `?v=${encodeURIComponent(hash)}`;
    }

    return url;
}

module.exports = (path) => appendAssetHash(path);
