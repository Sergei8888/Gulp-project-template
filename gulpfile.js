const { series, parallel, src, dest, watch } = require("gulp"); //Базовые компоненты gulp

const fs = require('fs')
const del = require("del"); //Удаляет файлы

const browserSync = require("browser-sync").create(); //Создает локальный сервер

const scss = require("gulp-dart-sass"); //Компилирует из scss в css
const minifyCss = require("gulp-clean-css"); //Сжимает css
const autoprefixer = require("gulp-autoprefixer"); //Допавляет префиксы к css

const babel = require("gulp-babel"); //Упрощает js код до более поддерживаемых стандартов
const babelMinify = require("gulp-babel-minify"); //Сжимает js

const obfuscate = require('gulp-javascript-obfuscator')

const include = require("gulp-file-include"); //Включение одного файла в определенную часть другого

const webp = require("gulp-webp"); //Конвертируем изображения в webp
const imagemin = require("gulp-imagemin"); //Сжимаем картинки
const { get } = require("browser-sync");

//FTP деплой
const gutil = require('gulp-util');
const ftp = require('vinyl-ftp');


// Логика путей в проекте
class FolderSpace {
    constructor(baseDir) {
        this.main = baseDir
        this.scss = baseDir + '/scss'
        this.css = baseDir + '/css'
        this.js = baseDir + '/js'
        this.img = baseDir + '/img'
        this.fonts = baseDir + '/fonts'
        this.video = baseDir + '/video'
    }
}

let path = {
    // Путевая карта проекта
    app: new FolderSpace('./app'),
    dist: new FolderSpace('./dist'),
    prod: new FolderSpace('./prod'),
};

//Параметры сборки
let options = {
    //Режим компиляции
    compile: 'dev',
}

// Задачи изменения параметров сборки
function changeCompileStateToDev(done) {
    options.compile = 'dev';
    done()
}

function changeCompileStateToProd(done) {
    options.compile = 'prod';
    done()
}

//Общие функции

// Задача отчистки предыдущих версий файлов
function clear() {
    if (options.compile === 'prod') {
        return (
            del(path.prod.js + "/*.js", { force: true }),
            del(path.prod.img + "/*", { force: true }),
            del(path.prod.css + "/*.css", { force: true }),
            del(path.prod.main + "/*.html", { force: true }),
            del(path.prod.fonts + "/*", { force: true }),
            del(path.prod.video + "/*", { force: true })
        );
    } else if (options.compile === 'dev') {
        return (
            del(path.dist.js + "/*.js", { force: true }),
            del(path.dist.img + "/*", { force: true }),
            del(path.dist.css + "/*.css", { force: true }),
            del(path.dist.main + "/*.html", { force: true }),
            del(path.dist.fonts + "/*", { force: true }),
            del(path.dist.video + "/*", { force: true })
        );
    } else {
        throw new Error('Compile setting does not exists')
    }
}

// Логика переноса файлов без изменений
//Cписок файлов которые нужно только перенести
let teleportList = [{
        inputDir: path.app.video, //откуда взять файл 
        outputDir: path.dist.video, //куда выкинуть dev
        prodDir: path.prod.video, //куда выкинуть prod
        get files() {
            return this.inputDir + '/*'
        }
    },
    {
        inputDir: path.app.fonts,
        outputDir: path.dist.fonts,
        prodDir: path.prod.fonts,
        get files() {
            return this.inputDir + '/*'
        }
    }
];

//Перенос файлов без обработки
function teleport(done) {
    // Функция переноса конкретного вида файлов
    function teleportItem(teleportingItem) {
        if (options.compile === 'prod') {
            return (src(teleportingItem.inputDir).pipe(dest(path.prod.main)), src(teleportingItem.files, {
                allowEmpty: true,
            }).pipe(dest(teleportingItem.prodDir)))
        } else if (options.compile === 'dev') {
            return (src(teleportingItem.inputDir).pipe(dest(path.dist.main)), src(teleportingItem.files, {
                allowEmpty: true,
            }).pipe(dest(teleportingItem.outputDir)))
        } else {
            throw new Error('Compile setting does not exists')
        }
    }

    for (let teleportingItem of teleportList) {
        teleportItem(teleportingItem)
    }

    done();
}

function htmlCompile() {
    if (options.compile === 'prod') {
        return src(path.app.main + "/*.html")
            .pipe(
                include()
            )
            .pipe(dest(path.prod.main));
    } else if (options.compile === 'dev') {
        return src(path.app.main + "/*.html")
            .pipe(
                include()
            )
            .pipe(dest(path.dist.main));
    } else {
        throw new Error('Compile setting does not exists')
    }
}

function sassCompile() {
    if (options.compile === 'prod') {
        return src(path.app.scss + "/*.scss")
            .pipe(scss())
            .pipe(autoprefixer())
            .pipe(minifyCss())
            .pipe(dest(path.prod.css));
    } else if (options.compile === 'dev') {
        return src(path.app.scss + "/*.scss")
            .pipe(scss())
            .pipe(dest(path.dist.css));
    } else {
        throw new Error('Compile setting does not exists')
    }
}

function jsCompile() {
    if (options.compile === 'prod') {
        return src(path.app.js + "/*.js")
            .pipe(
                babel({
                    presets: ["@babel/env"],
                })
            )
            .pipe(
                babelMinify({
                    builtIns: false,
                    mangle: {
                        keepClassName: true,
                    },
                })
            )
            .pipe(obfuscate())
            .pipe(dest(path.prod.js))
    } else if (options.compile === 'dev') {
        return src(path.app.js + "/*.js").pipe(dest(path.dist.js));
    }
}

// Обработка графики

let imageOptimizeSettings = [
    //Настройки оптимизации графики
    imagemin.gifsicle({
        interlaced: true,
        optimizationLevel: 3,
    }),
    imagemin.mozjpeg({ quality: 95, progressive: true }),
    imagemin.optipng({ optimizationLevel: 2 }),
    imagemin.svgo({
        plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
    }),
];

let imageList = [
    path.app.img + "/*.jpg",
    path.app.img + "/*.jpeg",
    path.app.img + "/*.png",
    path.app.img + "/*.jfif",
    path.app.img + "/*.svg",
    path.app.img + "/*.webp",
    path.app.img + "/*.gif",
    path.app.img + "/*.ico",
];

function imgCompile() {
    if (options.compile === 'prod') {
        return (
            src(imageList)
            .pipe(imagemin(imageOptimizeSettings))
            .pipe(dest(path.prod.img)),
            src(imageList.slice(0, 3))
            .pipe(webp())
            .pipe(imagemin(imageOptimizeSettings))
            .pipe(dest(path.prod.img))
        );
    } else if (options.compile === 'dev') {
        return (
            src(imageList)
            .pipe(dest(path.dist.img)),
            src(imageList.slice(0, 3))
            .pipe(webp())
            .pipe(dest(path.dist.img))
        );
    }
}

// Запуск Live Reload сервера

function browserSyncStart() {
    browserSync.init({
        server: {
            baseDir: path.dist.main,
            notify: false,
        },
    });

    //Слежка за изменением файлов и перезагрузка сервера
    watch(path.app.main + "/*.html", htmlCompile).on(
        "change",
        browserSync.reload
    );
    watch(path.app.link_templates + "/*.html", htmlCompile).on(
        "change",
        browserSync.reload
    );
    watch(path.app.scss + "/*.scss", sassCompile).on(
        "change",
        browserSync.reload
    );

    watch(imageList, imgCompile).on("change", browserSync.reload);
    watch(path.app.js + "/*.js", jsCompile).on("change", browserSync.reload);
    watch(path.app.video + "/*", compile)
}

function deploy() {
    let rawdata = fs.readFileSync('ftp.json');
    let ftpSettings = JSON.parse(rawdata);

    let conn = ftp.create({
        host: ftpSettings.adress,
        user: ftpSettings.username,
        password: ftpSettings.password,
        parallel: 10,
        log: gutil.log
    });

    let globs = [
        'prod/**',
    ];

    // using base = '.' will transfer everything to /public_html correctly
    // turn off buffering in gulp.src for best performance

    return src(globs, { buffer: false })
        .pipe(conn.dest('/www/test'));
};

// Обработка файлов при изменениях

function watchChanges() {
    //Слежка за изменением файлов без перезагрузки сервера
    watch(path.app.main + "/*.html", htmlCompile)
    watch(path.app.link_templates + "/*.html", htmlCompile)
    watch(path.app.scss + "/*.scss", sassCompile)

    watch(imageList, imgCompile)
    watch(path.app.js + "/*.js", jsCompile)
    watch(path.app.video + "/*", compile)
}

let compile = parallel(teleport, htmlCompile, sassCompile, jsCompile, imgCompile)

exports.deploy = series(changeCompileStateToProd, clear, compile, deploy)
exports.serve = series(changeCompileStateToDev, clear, compile, watchChanges);
exports.dev = series(changeCompileStateToDev, clear, compile, browserSyncStart);
exports.build = series(changeCompileStateToProd, clear, compile);
