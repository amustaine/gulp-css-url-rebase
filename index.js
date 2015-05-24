'use strict';

var path = require('path');
var fs = require('fs');
var urlHelper = require('url');
var mime = require('mime');
var mkdirp = require('mkdirp');
var rework = require('rework');
var reworkUrl = require('rework-plugin-url');
var through = require('through2');
var validator = require('validator');


function asyncTasks(tasks, cb) {
    var l = tasks.length, task;
    while (task = tasks.shift()) {
        task(function () {
            if (!--l) {
                cb && cb();
            }
        });
    }
}

var isAbsolute = function (p) {
    var normal = path.normalize(p);
    var absolute = path.resolve(p);
    return normal === absolute;
};

var rebaseUrls = function (css, options) {
    var tasks = [];
    var reworkedCss = rework(css)
        .use(reworkUrl(function (url) {
            if (validator.isURL(url) || /^(data:.*;.*,)/.test(url)) {
                return url;
            }
            var absolutePath = path.join(options.currentDir, url), p, stat,
                copyFiles = options.copyFiles;
            if (!copyFiles) {
                if (isAbsolute(url)) {
                    return url;
                }
                p = path.relative(options.root, absolutePath);
                if (process.platform === 'win32') {
                    p = p.replace(/\\/g, '/');
                }
            } else {
                console.log('absolutePath', absolutePath);
                var urlObj = urlHelper.parse(absolutePath);
                try {

                    if (stat = fs.statSync(urlObj.pathname)) {
                        var filename = path.basename(url),
                            targetFilename = path.basename(urlObj.pathname),
                            targetFullFilename = filename,
                            mimeType = mime.lookup(urlObj.pathname),
                            loader = {};
                        if (copyFiles.fileTypes) {
                            copyFiles.fileTypes.some(function (l) {
                                if (l.test.test(absolutePath)) {
                                    loader = l;
                                    return true;
                                }
                            });
                        }
                        if (loader.inlineLimit && stat.size <= loader.inlineLimit * 1024) {
                            p = 'data:' + mimeType + ';base64,' +
                                fs.readFileSync(urlObj.pathname).toString('base64');
                        } else {
                            if (copyFiles.rev) {
                                var rev = 'rev' + Date.now();
                                targetFullFilename = rev + '_' + targetFullFilename;
                                targetFilename = rev + '_' + targetFilename;
                            }
                            var finalDestPath = copyFiles.filePath;
                            var finalPublicPath = copyFiles.publicPath;
                            if (loader.folder) {
                                finalDestPath = path.join(finalDestPath, loader.folder);
                                finalPublicPath = path.normalize(finalPublicPath + path.sep + loader.folder);
                            }
                            mkdirp.sync(finalDestPath);
                            tasks.push(function (next) {
                                var ws = fs.createWriteStream(path.join(finalDestPath, targetFilename));
                                var rs = fs.createReadStream(urlObj.pathname);
                                ws.on('close', next);
                                ws.on('error', function (err) {
                                    throw new Error(err);
                                });
                                rs.on('error', function (err) {
                                    throw new Error(err);
                                });
                                rs.pipe(ws);
                            });

                            p = path.normalize(finalPublicPath + path.sep + targetFullFilename);
                        }

                    }
                } catch (e) {
                    console.error(e.stack);
                }

            }
            return p;
        })).toString();
    return {
        css: reworkedCss,
        tasks: tasks
    }
};
/**
 *
 * @param {Object} options
 * @param {String} options.root
 * @returns {*}
 */
module.exports = function (options) {
    options = options || {};
    var root = options.root || '.';
    return through.obj(function (file, enc, cb) {
        var resp = rebaseUrls(file.contents.toString(), {
            currentDir: path.dirname(file.path),
            file: file,
            root: path.join(file.cwd, root),
            copyFiles: options.copyFiles
        });
        file.contents = new Buffer(resp.css);
        this.push(file);
        console.log('resp.tasks', resp.tasks);
        if (resp.tasks.length) {
            asyncTasks(resp.tasks, cb);
        } else {
            cb();
        }

    });
};
