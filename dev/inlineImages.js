const fs = require('fs');
const through = require('through2');

/**
 * @param {String} root The path to the images root directory
 * @returns {Function} The filter to pipe a Gulp stream to
 */
module.exports = function inlineImages(root) {
    // Embed SVGs (/* @inline */ url(...)
    const pattern = /\/\*\s*@inline\s*\*\/\s*url\(\s*(['"])(.*?\.svg)\?.*?\1\s*\)/g;
    return through.obj((file, encoding, callback) => {
        let contents = file.contents.toString();

        contents = contents.replace(pattern, (original, _, path) => {
            if (path === '') {
                return original;
            }
            if (path.substr(0, 1) === '/') {
                // Absolute
                path = root + path;
            } else {
                // Relative
                throw new Error('Cannot handle relative paths yet');
            }

            const content = fs.readFileSync(path);
            const dataURI = `data:image/svg+xml,${encodeURIComponent(content)}`;

            return `url("${dataURI}")`;
        });

        file.contents = Buffer.from(contents);
        callback(null, file);
    });
};
