'use strict';

var path = require('path');
var fs = require('fs');
var urlHelper = require('url');
var mime = require('mime');
var mkdirp = require('mkdirp');
var through = require('through2');
var validator = require('validator');
var regxps = {
    cssUrl: /url\(['"](.*?)['"]\)|url\(([^'"].*?[^'"])\)/gi,
    //"cssPaths": /(?:(?:@import\s*(['"])(?![a-z]+:|\/)([^\r\n;{]+?)\1)|url\(\s*(['"]?)(?![a-z]+:|\/)([^\r\n;]+?)\3\s*\))([a-z, \s]*[;}]?)/g,
    //"cssPaths": /((@import)\s.*url\((['"]|)(.*?)(['"]|)\))|(url\((['"]|)(.*?)(['"]|)\))/g,
    "cssPaths": /((@import)\s.*?url\((['"]|)(.*?)\3\))|(url\((['"]|)(.*?)\6\))/g,
    "blockComment": /\/\*[\s\S]*?\*\/|\/\/.*/gi
}

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
var parseUrl = function (content, baseUrl, cb) {
    return content.replace(regxps.blockComment, "").replace(regxps.cssPaths,
        function (ignore, fullMatch, importTag, delim, importUrl, imgUrlMatch, delim2, imgUrl) {
            var url = importUrl || imgUrl;
            var absPath = path.resolve(baseUrl, url);
            var origStr = fullMatch || imgUrlMatch;
            if (url.match(/^http|^\/\//g)) {
                return origStr;
            }
            if (importTag) {
                try {
                    fs.statSync(absPath);
                    return parseUrl(fs.readFileSync(absPath, {encoding: 'utf8'}), path.dirname(absPath), cb);
                } catch (e) {
                    console.error(e.stack);
                    return origStr;
                }
            } else {
                //console.log('get url',url);
                url = cb(url);
            }
            return 'url("' + url + '")';
        });
}
var rebaseUrls = function (css, options) {
    var tasks = [];

    var reworkedCss = parseUrl(css, options.currentDir, function (url) {
        //console.log('url', url);
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
            //console.log('absolutePath', absolutePath);
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
                            var rev = 'rev_' + Date.now();
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
                console.error(e.message);
            }

        }
        return p;
    });
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
        console.log('file.path', file.path);
        var resp = rebaseUrls(file.contents.toString(), {
            currentDir: path.dirname(file.path),
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
