const { series, src, dest, watch } = require("gulp"); //Базовые компоненты gulp
const del = require("del"); //Удаляет файлы

const browserSync = require("browser-sync").create(); //Создает локальный сервер

const scss = require("gulp-dart-sass"); //Компилирует из scss в css
const minifyCss = require("gulp-clean-css"); //Сжимает css
const autoprefixer = require("gulp-autoprefixer"); //Допавляет префиксы к css

const babel = require("gulp-babel"); //Упрощает js код до более поддерживаемых стандартов
const babelMinify = require("gulp-babel-minify"); //Сжимает js

const concat = require("gulp-concat"); //Склеивание 2 файлов
const include = require("gulp-file-include"); //Включение одного файла в определенную часть другого

const webp = require("gulp-webp"); //Конвертируем изображения в webp
const imagemin = require("gulp-imagemin"); //Сжимаем картинки

const args = require("yargs").argv; //keyargs для вызовов в консоли

let hard = Boolean(
  args.hard
); /*Получаем через консоль значение для выбора типа сборки true/false
При дефолтном значении hard = false будет произведена soft(см. далее) сборка проекта в папку dist,
При выставлении флага --hard переменная hard принимает значение true и производится hard(см. далее) сборка*/

/*Перед началом работы вызвать npm i для установки всех зависимостей*/

/*soft сборка - сборка при которой происходит include для html, если таковые прописаны. 
Sass компилируется. Сss переносится без изменений. JS переносится без изменений.
Img растр конвертится в webp, сжимается и с изначальным файлом jpg и оптимизированным вектором переносится в папку.
Все указанные выше файлы переносятся с заменой в папку dist. Папка components со всем содержимым переносится без изменений.

hard сборка - выполняется, если hard принимает значение true. Html(см. soft). Sass проходит через autoprefixer и минифкацию, помимо компиляции.
Сss минифицируется. Все js файлы проходят через babel(см. описание require('gulp-babel'), минифицируются и собираются в общий bundle.js).
Img обрабатываются аналогично soft сборки. Папка components со всем содержимым переносится без изменений.
Все указанные выше файлы переносятся с заменой в папку ProdBuild(создается при первом запуске gulp build --hard).

В данной сборке доступно 2 таска - gulp dev и gulp build
При вызове gulp dev производится soft сборка, а так же запуск browsersync и слежка за файлами
При вызове gulp build производится soft сборка
При вызове gulp build --hard производится hard сборка

P.S Вы также можете отдельно вызывать gulp css/html/js/sass/clear/server/teleport*/

let path = {
  //Путевая карта проекта
  app: {
    main: "./app",
    get css() {
      return this.main + "/css";
    },
    get scss() {
      return this.main + "/scss";
    },
    get js() {
      return this.main + "/js";
    },
    get img() {
      return this.main + "/img";
    },
    get link_templates() {
      return this.main + "./link_templates";
    },
    get components() {
      return this.main + "/components";
    },
  },
  dist: {
    main: "./dist",
    get css() {
      return this.main + "/css";
    },
    get js() {
      return this.main + "/js";
    },
    get img() {
      return this.main + "/img";
    },
    get components() {
      return this.main + "/components";
    },
  },
  prod: {
    main: "./ProdBuild",
    get css() {
      return this.main + "/css";
    },
    get js() {
      return this.main + "/js";
    },
    get img() {
      return this.main + "/img";
    },
    get components() {
      return this.main + "/components";
    },
  },
};

function clear() {
  //Отчистка всех предыдущих файлов
  if (hard) {
    return (
      del(path.prod.js + "/*.js"),
      del(path.prod.img + "/*"),
      del(path.prod.css + "/*.css"),
      del(path.prod.main + "/*.html")
    );
  }
  return (
    del(path.dist.js + "/*.js"),
    del(path.dist.img + "/*"),
    del(path.dist.css + "/*.css"),
    del(path.dist.main + "/*.html")
  );
}

let teleportList = [path.app.components + '/*'];

function teleport() {
  //Перенос файлов без обработки
  if (hard) {
    return src(teleportList).pipe(dest(path.prod.components));
  }
  return src(teleportList).pipe(dest(path.dist.components));
}

function htmlCompile() {
  if (hard) {
    return src(path.app.main + "/*.html")
      .pipe(
        include({
          context: {
            hard,
          },
        })
      )
      .pipe(dest(path.prod.main));
  }
  return src(path.app.main + "/*.html")
    .pipe(
      include({
        context: {
          hard,
        },
      })
    )
    .pipe(dest(path.dist.main));
}

function sassCompile() {
  if (hard) {
    return src(path.app.scss + "/*.scss")
      .pipe(scss())
      .pipe(autoprefixer())
      .pipe(minifyCss())
      .pipe(dest(path.prod.css));
  }
  return src(path.app.scss + "/*.scss")
    .pipe(scss())
    .pipe(dest(path.dist.css));
}

function cssCompile() {
  if (hard) {
    return src(path.app.css + "/*.css")
      .pipe(minifyCss())
      .pipe(dest(path.prod.css));
  }
  return src(path.app.css + "/*.css").pipe(dest(path.dist.css));
}

function jsCompile() {
  if (hard) {
    return src(path.app.js + "/*.js")
      .pipe(
        babel({
          presets: ["@babel/env"],
        })
      )
      .pipe(
        babelMinify({
          mangle: {
            keepClassName: true,
          },
        })
      )
      .pipe(concat("bundle.js"))
      .pipe(dest(path.prod.js));
  }
  return src(path.app.js + "/*.js").pipe(dest(path.dist.js));
}

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
  if (hard) {
    return (
      src(imageList)
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest(path.prod.img)),
      src(imageList.slice(0, 3))
        .pipe(webp())
        .pipe(imagemin(imageOptimizeSettings))
        .pipe(dest(path.prod.img))
    );
  }
  return (
    src(imageList)
      .pipe(imagemin(imageOptimizeSettings))
      .pipe(dest(path.dist.img)),
    src(imageList.slice(0, 3))
      .pipe(webp())
      .pipe(imagemin(imageOptimizeSettings))
      .pipe(dest(path.dist.img))
  );
}

function browserSyncStart() {
  browserSync.init({
    server: {
      baseDir: path.dist.main,
      notify: false,
    },
  });

  //Слежка за изменением файлов
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
  watch(path.app.css + "/*.css", cssCompile).on("change", browserSync.reload);
  watch(imageList, imgCompile).on("change", browserSync.reload);
  watch(path.app.js + "/*.js", jsCompile).on("change", browserSync.reload);
}

compile = series(
  htmlCompile,
  sassCompile,
  cssCompile,
  jsCompile,
  imgCompile,
  teleport
);

exports.clear = clear;
exports.html = htmlCompile;
exports.css = cssCompile;
exports.sass = sassCompile;
exports.js = jsCompile;
exports.teleport = teleport;
exports.server = browserSyncStart;

exports.dev = series(clear, compile, browserSyncStart);
exports.build = series(clear, compile);
