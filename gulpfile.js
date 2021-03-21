const { series, src, dest, watch } = require('gulp') //Базовые компоненты gulp
const del = require('del') //Удаляет файлы

const browserSync = require('browser-sync').create() //Создает локальный сервер

const scss = require('gulp-dart-sass') //Компилирует из scss в css
const minifyCss = require('gulp-clean-css') //Сжимает css
const autoprefixer = require('gulp-autoprefixer') //Допавляет префиксы к css

const babel = require('gulp-babel') //Упрощает js код до более поддерживаемых стандартов
const babelMinify = require('gulp-babel-minify') //Сжимает js

const concat = require('gulp-concat') //Склеивание 2 файлов
const include = require('gulp-file-include') //Включение одного файла в определенную часть другого

const webp = require('gulp-webp') //Конвертируем изображения в webp
const imagemin = require('gulp-imagemin') //Сжимаем картинки

const args = require('yargs').argv; //keyargs для вызовов в консоли

let hard = Boolean(args.hard); /*Получаем через консоль значение для выбора типа сборки true/false
                                При дефолтном значении hard = false будет произведена soft(см. далее) сборка проекта в папку dist,
                                При выставлении флага --hard переменная hard принимает значение true и производится hard(см. далее) сборка*/

/*Перед началом работы вызвать npm i для установки всех зависимостей*/

/*soft сборка - сборка при которой происходит include для html, если таковые прописаны. 
Sass компилируется. Сss переносится без изменений. JS переносится без изменений.
Img растр конвертится в webp, сжимается и с изначальным файлом jpg и оптимизированным вектором переносится в папку.
Все указанные выше файлы переносятся с заменой в папку dist.

hard сборка - выполняется, если hard принимает значение true. Html(см. soft). Sass проходит через autoprefixer и минифкацию, помимо компиляции.
Сss минифицируется. Все js файлы проходят через babel(см. описание require('gulp-babel'), минифицируются и собираются в общий bundle.js).
Img обрабатываются аналогично soft сборки.
Все указанные выше файлы переносятся с заменой в папку ProdBuild(создается при первом запуске gulp build --hard).

В данной сборке доступно 2 таска - gulp dev и gulp build
При вызове gulp dev производится soft сборка, а так же запуск browsersync и слежения за файлами
При вызове gulp build производится soft сборка
При вызове gulp build --hard производится hard сборка

P.S Вы также можете отдельно вызывать gulp css/html/js/sass/clear/server*/


function clear() { //Отчистка всех предыдущих файлов
    if (hard){
        return del('./ProdBuild/js/*'),
        del('./ProdBuild/img/*'),
        del('./ProdBuild/css/*'),
        del('./ProdBuild/*.html')
    }
    return del('./dist/js/*'),
        del('./dist/img/*'),
        del('./dist/css/*'),
        del('./dist/*.html')
}

function htmlCompile() { 
    if (hard){
        return src('./app/*.html')
        .pipe(include({
            context: {
                hard
            }
        }))
        .pipe(dest('./ProdBuild'))
    }
    return src('./app/*.html')
    .pipe(include({
        context: {
            hard
        }
    }))
    .pipe(dest('./dist'))
}

function sassCompile() {
    if (hard){
        return src('./app/scss/*.scss')
        .pipe(scss())
        .pipe(autoprefixer())
        .pipe(minifyCss())
        .pipe(dest('./ProdBuild/css'))
    }
    return src('./app/scss/*.scss')
        .pipe(scss())
        .pipe(dest('./dist/css'))
    
}

function cssCompile() {
    if (hard){
        return src('./app/css/*.css')
        .pipe(minifyCss())
        .pipe(dest('./ProdBuild/css'))
    }
    return src('./app/css/*.css')
        .pipe(dest('./dist/css'))
}

function jsCompile() {
    if (hard){
       return src('./app/js/*.js')
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(babelMinify({
            mangle: {
                keepClassName: true
            }
        }))
        .pipe(concat('bundle.js'))
        .pipe(dest('./ProdBuild/js'))
    } 
    return src('./app/js/*.js')
        .pipe(dest('./dist/js'))
}

let imageOptimizeSettings = [ //Настройки оптимизации графики
    imagemin.gifsicle({
        interlaced: true,
        optimizationLevel: 3
    }),
    imagemin.mozjpeg({ quality: 95, progressive: true }),
    imagemin.optipng({ optimizationLevel: 2 }),
    imagemin.svgo({
        plugins: [
            { removeViewBox: true },
            { cleanupIDs: false }
        ]
    })
]

let imageList = ['./app/img/**.jpg', './app/img/**.jpeg', './app/img/**.png', './app/img/**.jfif', './app/img/**.svg', './app/img/**.webp', './app/img/**.gif']

function imgCompile() {
    if (hard){
        return src(imageList)
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest('./ProdBuild/img')),

        src(imageList.slice(0, 3))
        .pipe(webp())
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest('./ProdBuild/img'))
    }
    return src(imageList)
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest('./dist/img')),

        src(imageList.slice(0, 3))
        .pipe(webp())
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest('./dist/img'))
    
}

function browserSyncStart() {
    browserSync.init({
        server: {
            baseDir: "./dist",
            notify: false
        }
    });

    //Слежка за изменением файлов
    watch('./app/*.html', htmlCompile).on('change', browserSync.reload)
    watch('./app/link_templates/*.html', htmlCompile).on('change', browserSync.reload)
    watch('./app/scss/*.scss', sassCompile).on('change', browserSync.reload)
    watch('./app/css/*.css', sassCompile).on('change', browserSync.reload)
    watch(imageList, imgCompile).on('change', browserSync.reload)
    watch('./app/js/*.js', jsCompile).on('change', browserSync.reload)
}

compile = series(htmlCompile, sassCompile, cssCompile, jsCompile, imgCompile)

exports.clear = clear
exports.html = htmlCompile
exports.css = cssCompile
exports.sass = sassCompile
exports.js = jsCompile
exports.server = browserSyncStart

exports.dev = series(clear, compile, browserSyncStart)
exports.build = series(clear, compile)