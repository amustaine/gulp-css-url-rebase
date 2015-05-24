# gulp-css-url-rebase [![Build Status](https://travis-ci.org/42Zavattas/gulp-css-url-rebase.svg?branch=master)](https://travis-ci.org/42Zavattas/gulp-css-url-rebase) [![Dependency Status](https://david-dm.org/42Zavattas/gulp-css-url-rebase.svg)](https://david-dm.org/42Zavattas/gulp-css-url-rebase)

> Rebase relative image URLs

_This project has been forked to fix issues that were not resolved by its original author._

## Install

    npm install gulp-css-url-rebase --save-dev

## Example

```javascript
var gulp = require('gulp');
var rebase = require('gulp-css-url-rebase');

gulp.task('default', function () {
  gulp.src('css/**/*.css')
    .pipe(rebase())
     .pipe(concat('style.css'))
     .pipe(gulp.dest('./build/'));
});
```

rebase urls and copy files

```javascript
var gulp = require('gulp');
var rebase = require('gulp-css-url-rebase');

gulp.task('default', function () {
  gulp.src(['css/**/*.css',
            'plugins/font-awesome/css/font-awesome.min.css',
            'plugins/bootstrap/css/bootstrap.min.css'])
    .pipe(rebase({
        copyFiles:{
            //urls in css will be rebased relative to publicPath
            publicPath: "./assets",
            //where to copy the files
            filePath: './build/assets/',
            fileTypes: [
                {
                    //match file extensions
                    test: /\.(png|jpg|gif)$/,
                    //subfolder relative to filePath
                    folder: 'img',
                    //max file size for data uri in kb
                    inlineLimit: 100
                },
                {
                    test: /\.(woff|woff2|eot|ttf|svg)(\?.*?|)$/,
                    folder: 'font'
                }
            ]
        }    
    }))
     .pipe(concat('style.css'))
     .pipe(gulp.dest('./build/'));
});
```

## What it tries to solve

Let's say you have this structure:

    css
    ├ style.css
    ├ some
    │  └ deep-path/
    │     └ style.css
    img
     ├ logo.png
     ├ cat.png
     └ icons/
       ├ home.png
       └ cancel.png
       
    bower_components
    ├ dep1
    │    ├ images/*
    │    └ css/
    │        └ style.css
    ├ dep2
    │    ├ images/*
    │    └ css/
    │        └ style.css
In `dep1/css/style.css` you might have:

```css
.sel {
  background: url('../images/icons/home.png') no-repeat top left;
}
```

And in `dep2/css/style.css`:

```css
.item {
  background: url('../images/logo.jpg') no-repeat top left;
}
```

When I minify everything, for example to be in `./style.css` in
production. I want this final file for the css above:

```css
.sel {
  background: url('img/icons/home.jpg') no-repeat top left;
}
.item {
  background: url('img/logo.jpg') no-repeat top left;
}
```

