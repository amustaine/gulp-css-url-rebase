'use strict';

var fs = require('fs');

var path = require('path');
var assert = require('assert');
var gutil = require('gulp-util');
var cssRebaseUrls = require('../index');

var testPath = __dirname;

var read = function (name) {
    return fs.readFileSync(path.join(__dirname, name));
};

describe('gulp-css-url-rebase', function () {

    it('should assert when root is not specified', function (cb) {

        var stream = cssRebaseUrls();

        stream.on('data', function (file) {
            assert.equal(file.contents.toString('utf8'), read('1/expected.css').toString('utf-8'));
            cb();
        });

        stream.write(new gutil.File({
            base: testPath + '/1',
            path: testPath + '/1/style.css',
            contents: read('1/test.css')
        }));

        stream.end();

    });

    it('should assert when root is specified', function (cb) {

        var stream = cssRebaseUrls({root: './css'});

        stream.on('data', function (file) {
            assert.equal(file.contents.toString('utf8'), read('2/expected.css').toString('utf-8'));
            cb();
        });

        stream.write(new gutil.File({
            base: testPath + '/2',
            path: testPath + '/2/style.css',
            contents: read('2/test.css')
        }));

        stream.end();

    });
    it('should copy content and rebase url', function (cb) {

        var stream = cssRebaseUrls({
            copyFiles: {
                publicPath: "./dist/",
                filePath: path.join(__dirname, '3/expected'),
                fileTypes: [
                    {
                        test: /\.(png|jpg|gif)$/,
                        folder: 'img',
                        inlineLimit: 100
                    },
                    {
                        test: /\.(woff|woff2|eot|ttf|svg)(\?.*?|)$/,
                        folder: 'font'
                    }
                ],
                rev: false
            }

        });

        stream.on('data', function (file) {
            console.log(file.contents.toString('utf8'));

            //assert.equal(file.contents.toString('utf8'), read('3/expected.css').toString('utf-8'));
            cb();
        });

        stream.write(new gutil.File({
            base: testPath + '/3',
            path: testPath + '/3/style.css',
            contents: read('3/test.css')
        }));

        stream.end();

    });

});
