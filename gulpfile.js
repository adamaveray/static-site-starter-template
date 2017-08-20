const neat         = require('bourbon-neat').includePaths;
const browserify   = require('browserify');
const fs           = require('fs');
const del          = require('del');
const gulp         = require('gulp');
const autoprefixer = require('gulp-autoprefixer');
const buffer       = require('gulp-buffer');
const cleanCSS     = require('gulp-clean-css');
const data         = require('gulp-data');
const env          = require('gulp-environment');
const filter       = require('gulp-filter');
const htmlmin      = require('gulp-htmlmin');
const gulpif       = require('gulp-if');
const imagemin     = require('gulp-imagemin');
const rename       = require('gulp-rename');
const responsive   = require('gulp-responsive-images');
const nunjucks     = require('gulp-nunjucks-render');
const sass         = require('gulp-sass');
const sassVars     = require('gulp-sass-vars');
const sourcemaps   = require('gulp-sourcemaps');
const tap          = require('gulp-tap');
const path         = require('path');
const inlineImages = require('./dev/inlineImages');

const config = require('./package.json').config || {};
const imageSizes = require('./dev/image-sizes');
const templateVars = { ...config.templateVars, isProduction: !!env.production };

const typescriptConfig = require('./tsconfig.json');

const setupNunjucks = require('./dev/nunjucks');
const sassFunctions = require('./dev/sass');

const base = 'src';
const paths = {
    html:  {
        src:  'src/**/*.njk',
        dest: 'dist/',
    },
    css:  {
        src:  'src/css/**/*.scss',
        dest: 'dist/css/',
    },
    js: {
        src:  'src/js/**/*.{js,ts,tsx}',
        dest: 'dist/js/',
    },
    img: {
        src:  'src/img/**/*.*',
        dest: 'dist/img/',
    },
    meta: {
        src:  config.copyFiles.map((path) => `src/${path}`),
        dest: 'dist/',
    },
};

const filterUnderscores = (file) => !file.path.match(/\/_[^\/]/);
const filterMinified = (file) => !file.path.match(/\.min\.\w+$/);

function clean() {
    return del('dist/*');
}

function html() {
    nunjucks.nunjucks.configure('src', config.nunjucks);

    const nunjucksLoader = {
        getSource(name) {
            const filePath = path.join('src', `${name}.njk`);
            return {
                path: filePath,
                src: fs.readFileSync(filePath)+'',
            };
        }
    };

    return gulp.src(paths.html.src, {base})
        .pipe(filter(filterUnderscores))
        .pipe(data(templateVars))
        .pipe(sourcemaps.init())
        .pipe(nunjucks({
            path: 'src',
            loaders: [nunjucksLoader],
            manageEnv: setupNunjucks,
        }))
        .pipe(htmlmin(config.htmlmin))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(paths.html.dest));
}

function css() {
    const minifiedFilter = filter(filterMinified, {restore: true});
    return gulp.src(paths.css.src, {base: path.join(base, 'css')})
        .pipe(filter(filterUnderscores))
        .pipe(sourcemaps.init())
        .pipe(minifiedFilter)
        .pipe(sassVars(templateVars, { verbose: false }))
        .pipe(sass({
            includePaths: [neat],
            functions: sassFunctions(sass.compiler),
        }))
        .pipe(env.if.production(inlineImages('dist')))
        .pipe(cleanCSS())
        .pipe(minifiedFilter.restore)
        .pipe(autoprefixer(config.autoprefixer))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(paths.css.dest));
}

function js() {
    const minifiedFilter = filter(filterMinified, {restore: true});
    return gulp.src(paths.js.src, {base: path.join(base, 'js')})
        .pipe(filter(filterUnderscores))
        .pipe(minifiedFilter)
        .pipe(sourcemaps.init())
        .pipe(tap((file) => {
            const b = browserify(file.path);
            if (file.extname === 'ts' || file.extname === 'tsx') {
                b.plugin('tsify', typescriptConfig);
            }
            if (env.production) {
                b.plugin('tinyify', {flat: false});
            }
            // Replace file contents with Browserify's bundle stream
            file.contents = b.bundle();
        }))
        .pipe(buffer())
        .pipe(rename({extname: '.js'}))
        .pipe(minifiedFilter.restore)
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(paths.js.dest));
}

function img() {
    // Convert image sizes format to responsiveImages format
    const processedConfig = {};
    for (const image in imageSizes) {
        const thisSizes  = imageSizes[image];
        const thisConfig = [];
        for (const key in thisSizes) {
            let options = thisSizes[key];
            if (Array.isArray(options)) {
                options = {
                    width: options[0],
                    height: options[1],
                    crop: !!options[2],
                };
            }
            options.quality = options.quality || config.images.defaultQuality || 100;

            if (options.rename == null) {
                options.rename = {};

                // Handle extensions
                let basename = key;
                const ext    = path.extname(key);
                if (ext !== '') {
                    basename = basename.substr(0, basename.length - ext.length);
                    options.rename.extname = ext;
                }

                if (basename.substr(0, 1) === '~') {
                    // Relative
                    options.rename.suffix = basename.substr(1);
                } else {
                    // Absolute
                    options.rename.basename = basename;
                }
            }

            thisConfig.push(options);
        }

        processedConfig[image] = thisConfig;
    }

    return gulp.src(paths.img.src, {base: base+'/img'})
        .pipe(gulpif((file) => {
            const relativePath = file.path.substr(path.join(file.cwd, file.base).length+1);
            return (processedConfig[relativePath] != null);
        }, responsive(processedConfig)))
        .pipe(env.if.production(imagemin()))
        .pipe(gulp.dest(paths.img.dest));
}

function meta() {
    return gulp.src(paths.meta.src)
        .pipe(gulp.dest(paths.meta.dest));
}

function watch() {
    gulp.watch(paths.html.src, html);
    gulp.watch(paths.js.src, js);
    gulp.watch(paths.css.src, css);
    gulp.watch(paths.img.src, img);
    gulp.watch(paths.meta.src, meta);
}

gulp.task('html', html);
gulp.task('css', css);
gulp.task('js', js);
gulp.task('img', img);
gulp.task('meta', meta);

const buildFlow = env.production
    ? gulp.series(gulp.parallel(img, meta, js), css, html)
    : gulp.parallel(html, css, js, img, meta);
gulp.task('clean', clean);
gulp.task('build', gulp.series(clean, buildFlow));
gulp.task('watch', watch);

gulp.task('default', gulp.series('build'));
