let _ = require('lodash');
let fs = require('fs');
let gulp = require('gulp');
let less = require('gulp-less');
let path = require('path');
let rev = require('gulp-rev');
let source = require('vinyl-source-stream');
let streamify = require('gulp-streamify');
let through2 = require('through2');
let Q = require('q');
let yarb = require('yarb');

var devMode = String(process.env.NODE_ENV) !== 'production';

const CACHED_BUNDLES = new Map();
const STATIC_DIR = path.resolve(__dirname, '../static');
const BUILD_DIR = path.resolve(STATIC_DIR, 'build');
const STYLES_DIR = path.resolve(STATIC_DIR, 'styles');
const SCRIPTS_DIR = path.resolve(STATIC_DIR, 'scripts');

const revManifestPath = path.resolve(BUILD_DIR, 'rev-manifest.json');
const revManifest = {};

if (fs.existsSync(revManifestPath)) {
  _.assign(revManifest, JSON.parse(fs.readFileSync(revManifestPath)));
}

function writeManifest() {
  fs.writeFileSync(revManifestPath, JSON.stringify(revManifest));
}

function writeResource(stream) {
  let deferred = Q.defer();

  stream
    .pipe(streamify(rev()))
    .pipe(gulp.dest(BUILD_DIR))
    .pipe(rev.manifest())
    .pipe(through2.obj(function (chunk, encoding, callback) {
      _.assign(revManifest, JSON.parse(chunk.contents));
      callback();
    }))
    .on('finish', function () {
      deferred.resolve();
    });

  return deferred.promise;
}

function buildStyles() {
  return writeResource(
    gulp.src(path.resolve(STYLES_DIR, '*.less'))
    .pipe(less({
      rootpath: '/static/',
      relativeUrls: true,
      plugins: [
        new (require('less-plugin-clean-css'))({compatibility: 'ie8'})
      ]
    }))
  ).done(writeManifest);
}

function transformBundle(bundle) {
  bundle.transform('babelify');
  bundle.transform('envify', {global: true});
  return bundle;
}

function runYarb(resourceName, callback) {
  if (resourceName in CACHED_BUNDLES) {
    return CACHED_BUNDLES.get(resourceName);
  }

  let bundle = transformBundle(yarb(path.resolve(SCRIPTS_DIR, resourceName), {
    debug: devMode // Enable sourcemaps if in development mode
  }));

  if (callback) {
    callback(bundle);
  }

  CACHED_BUNDLES.set(resourceName, bundle);
  return bundle;
}

function bundleScripts(b, resourceName) {
  return b.bundle().on('error', console.log).pipe(source(resourceName));
}

function writeScript(b, resourceName) {
  return writeResource(bundleScripts(b, resourceName));
}

function buildScripts() {
  process.env.NODE_ENV = String(process.env.DEVELOPMENT_SERVER) === '1' ? 'development' : 'production';

  let commonBundle = runYarb('common.js');

  let attacherBundle = runYarb('attacher.js', function (b) {
    b.external(commonBundle);
  });

  return Q.all([
    writeScript(commonBundle, 'common.js'),
    writeScript(attacherBundle, 'attacher.js'),
  ]).then(writeManifest);
}

gulp.task('styles', buildStyles);
gulp.task('scripts', buildScripts);

gulp.task('clean', function () {
  var fileRegex = /^([a-z\-]+)-[a-f0-9]+\.(js|css)$/;

  fs.readdirSync(BUILD_DIR).forEach(function (file) {
    if (fileRegex.test(file) && revManifest[file.replace(fileRegex, '$1.$2')] !== file) {
      fs.unlinkSync(path.resolve(BUILD_DIR, file));
    }
  });
});

gulp.task('default', ['styles', 'scripts']);
