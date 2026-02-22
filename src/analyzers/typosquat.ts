import { fetchPopularPackages } from './typosquat-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TyposquatResult {
  /** Whether the package name looks suspiciously similar to a popular package. */
  isRisky: boolean;
  /** List of popular packages that are suspiciously close. */
  similarPackages: string[];
  /** Minimum Levenshtein distance found (0 = exact match). */
  distance: number;
}

// ---------------------------------------------------------------------------
// Top 1000+ popular npm packages (curated list, organized by category)
// ---------------------------------------------------------------------------

const POPULAR_PACKAGES: readonly string[] = [
  // ---------------------------------------------------------------------------
  // Core frameworks — React ecosystem
  // ---------------------------------------------------------------------------
  'react', 'react-dom', 'react-router', 'react-router-dom', 'react-redux',
  'react-hook-form', 'react-query', 'react-select', 'react-table',
  'react-dnd', 'react-dnd-html5-backend', 'react-beautiful-dnd',
  'react-virtualized', 'react-window', 'react-spring',
  'react-transition-group', 'react-modal', 'react-toastify',
  'react-icons', 'react-helmet', 'react-helmet-async',
  'react-intl', 'react-i18next', 'react-dropzone',
  'react-datepicker', 'react-color', 'react-slider',
  'react-markdown', 'react-syntax-highlighter', 'react-copy-to-clipboard',
  'react-error-boundary', 'react-hot-toast', 'react-loading-skeleton',
  'react-player', 'react-responsive', 'react-use',
  'react-aria', 'react-paginate', 'react-infinite-scroll-component',
  'react-lazy-load-image-component', 'react-card-flip',
  'react-countup', 'react-fast-compare', 'react-is',
  'create-react-app', 'react-scripts', 'react-app-rewired',
  'react-refresh', 'react-dev-utils',

  // ---------------------------------------------------------------------------
  // Core frameworks — Redux ecosystem
  // ---------------------------------------------------------------------------
  'redux', 'redux-thunk', 'redux-saga', 'redux-persist',
  'redux-toolkit', 'redux-observable', 'redux-form',
  'redux-actions', 'redux-logger', 'redux-devtools-extension',
  'reselect', 'redux-immutable',

  // ---------------------------------------------------------------------------
  // Core frameworks — Next.js / Gatsby / Remix / Astro
  // ---------------------------------------------------------------------------
  'next', 'nextjs', 'next-auth', 'next-seo', 'next-i18next',
  'next-compose-plugins', 'next-images', 'next-transpile-modules',
  'gatsby', 'gatsby-plugin-image', 'gatsby-plugin-sharp',
  'gatsby-transformer-sharp', 'gatsby-source-filesystem',
  'gatsby-plugin-react-helmet', 'gatsby-plugin-manifest',
  'gatsby-plugin-offline', 'gatsby-plugin-mdx',
  'remix', 'remix-run', '@remix-run/node', '@remix-run/react',
  '@remix-run/serve', '@remix-run/dev',
  'astro', '@astrojs/react', '@astrojs/vue', '@astrojs/svelte',
  '@astrojs/tailwind', '@astrojs/node', '@astrojs/vercel',

  // ---------------------------------------------------------------------------
  // Core frameworks — Vue ecosystem
  // ---------------------------------------------------------------------------
  'vue', 'vuex', 'vue-router', 'nuxt', 'nuxt3',
  'pinia', 'vue-loader', 'vue-template-compiler',
  '@vue/cli-service', '@vue/compiler-sfc', '@vue/reactivity',
  'vue-i18n', 'vue-meta', 'vuetify', 'quasar',
  'vuepress', 'vitepress', 'vue-demi', 'unplugin-vue-components',

  // ---------------------------------------------------------------------------
  // Core frameworks — Angular ecosystem
  // ---------------------------------------------------------------------------
  'angular', '@angular/core', '@angular/common', '@angular/compiler',
  '@angular/forms', '@angular/router', '@angular/platform-browser',
  '@angular/platform-browser-dynamic', '@angular/animations',
  '@angular/cdk', '@angular/material', '@angular/cli',
  '@angular/http', '@angular/platform-server',
  'zone.js', 'rxjs',

  // ---------------------------------------------------------------------------
  // Core frameworks — Svelte / SolidJS / Preact / Lit / Ember / misc
  // ---------------------------------------------------------------------------
  'svelte', '@sveltejs/kit', '@sveltejs/adapter-auto',
  '@sveltejs/adapter-node', '@sveltejs/adapter-static', '@sveltejs/vite-plugin-svelte',
  'solid-js', '@solidjs/router', '@solidjs/meta',
  'preact', 'preact-render-to-string', 'preact-router',
  'lit', 'lit-html', 'lit-element',
  'ember-cli', 'ember-source', '@ember/test-helpers',
  'stencil', '@stencil/core',
  'alpine', 'alpinejs', 'htmx.org', 'stimulus', '@hotwired/turbo',
  'qwik', '@builder.io/qwik', '@builder.io/qwik-city',

  // ---------------------------------------------------------------------------
  // Build tools / bundlers
  // ---------------------------------------------------------------------------
  'webpack', 'webpack-cli', 'webpack-dev-server', 'webpack-merge',
  'webpack-bundle-analyzer', 'webpack-dev-middleware', 'webpack-hot-middleware',
  'html-webpack-plugin', 'mini-css-extract-plugin', 'copy-webpack-plugin',
  'terser-webpack-plugin', 'css-minimizer-webpack-plugin',
  'rollup', '@rollup/plugin-node-resolve', '@rollup/plugin-commonjs',
  '@rollup/plugin-typescript', '@rollup/plugin-json', '@rollup/plugin-babel',
  '@rollup/plugin-terser', '@rollup/plugin-alias', '@rollup/plugin-replace',
  'esbuild', 'esbuild-register', 'esbuild-loader',
  'parcel', '@parcel/transformer-sass', '@parcel/packager-ts',
  'vite', 'vitest', '@vitejs/plugin-react', '@vitejs/plugin-vue',
  'turbo', 'turbopack', 'turborepo',
  'tsup', 'unbuild', 'microbundle',
  'swc', '@swc/core', '@swc/cli', '@swc/helpers',
  'babel-core', '@babel/core', '@babel/preset-env', '@babel/preset-react',
  '@babel/preset-typescript', '@babel/plugin-transform-runtime',
  '@babel/runtime', '@babel/parser', '@babel/traverse',
  '@babel/generator', '@babel/types', '@babel/template',
  '@babel/plugin-proposal-decorators', '@babel/plugin-proposal-class-properties',
  'babel-loader', 'babel-plugin-module-resolver',
  'babel-plugin-styled-components', 'babel-jest',
  'metro', 'metro-react-native-babel-preset',

  // ---------------------------------------------------------------------------
  // TypeScript ecosystem
  // ---------------------------------------------------------------------------
  'typescript', 'ts-node', 'tsx', 'ts-jest', 'ts-loader',
  'ts-morph', 'ts-prune', 'ts-patch', 'ts-toolbelt',
  'tslib', 'tsconfig-paths', 'tsc-watch', 'tsutils',
  'typedoc', 'type-fest', 'utility-types', 'ts-essentials',
  'ttypescript', 'dts-bundle-generator', 'api-extractor',

  // ---------------------------------------------------------------------------
  // Testing frameworks & utilities
  // ---------------------------------------------------------------------------
  'jest', 'jest-cli', 'jest-environment-jsdom', 'jest-circus',
  'jest-extended', 'jest-mock-extended', 'jest-when',
  'jest-image-snapshot',
  'mocha', 'chai', 'chai-as-promised', 'chai-http', 'chai-spies',
  'jasmine', 'jasmine-core', 'karma', 'karma-chrome-launcher',
  'karma-jasmine', 'karma-webpack',
  'vitest', '@vitest/coverage-v8', '@vitest/ui',
  'cypress', 'cypress-real-events', 'cypress-axe',
  'playwright', '@playwright/test', 'playwright-core',
  'puppeteer', 'puppeteer-core', 'puppeteer-extra',
  'sinon', 'sinon-chai', 'nock', 'msw',
  'supertest', 'ava', 'tape', 'tap',
  'nyc', 'c8', 'istanbul', 'istanbul-lib-coverage',
  '@testing-library/react', '@testing-library/jest-dom',
  '@testing-library/user-event', '@testing-library/vue',
  '@testing-library/angular', '@testing-library/svelte',
  '@testing-library/dom', '@testing-library/react-hooks',
  'enzyme', 'enzyme-adapter-react-16', 'react-test-renderer',
  'storybook', '@storybook/react', '@storybook/vue3',
  '@storybook/addon-actions', '@storybook/addon-essentials',
  '@storybook/addon-links', '@storybook/testing-library',
  'faker', '@faker-js/faker', 'chance', 'casual',
  'expect', 'should', 'power-assert', 'assert',
  'testcafe', 'nightwatch', 'webdriverio', 'selenium-webdriver',
  'detox', 'appium',

  // ---------------------------------------------------------------------------
  // Linting & formatting
  // ---------------------------------------------------------------------------
  'eslint', 'prettier', 'stylelint', 'tslint',
  'eslint-config-airbnb', 'eslint-config-airbnb-base',
  'eslint-config-standard', 'eslint-config-prettier',
  'eslint-config-next', 'eslint-config-react-app',
  'eslint-plugin-react', 'eslint-plugin-react-hooks',
  'eslint-plugin-jsx-a11y', 'eslint-plugin-import',
  'eslint-plugin-prettier', 'eslint-plugin-jest',
  'eslint-plugin-testing-library', 'eslint-plugin-vue',
  'eslint-plugin-node', 'eslint-plugin-security',
  'eslint-plugin-unicorn', 'eslint-plugin-sonarjs',
  'eslint-plugin-simple-import-sort', 'eslint-plugin-unused-imports',
  '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin',
  'eslint-import-resolver-typescript', 'eslint-plugin-cypress',
  'stylelint-config-standard', 'stylelint-order',
  'husky', 'lint-staged', 'commitlint',
  '@commitlint/cli', '@commitlint/config-conventional',
  'editorconfig', 'sort-package-json',
  'oxlint', 'biome', '@biomejs/biome',

  // ---------------------------------------------------------------------------
  // HTTP clients & servers
  // ---------------------------------------------------------------------------
  'express', 'express-session', 'express-validator',
  'express-async-errors', 'express-async-handler',
  'fastify', '@fastify/cors', '@fastify/helmet', '@fastify/jwt',
  '@fastify/rate-limit', '@fastify/multipart', '@fastify/static',
  '@fastify/swagger', '@fastify/cookie', '@fastify/session',
  'koa', 'koa-router', 'koa-bodyparser', 'koa-cors', 'koa-static',
  'hapi', '@hapi/hapi', '@hapi/joi', '@hapi/boom', '@hapi/inert',
  'restify', 'polka', 'micro', 'sirv',
  'axios', 'got', 'node-fetch', 'undici', 'request',
  'superagent', 'isomorphic-fetch', 'cross-fetch',
  'ky', 'wretch', 'redaxios', 'ofetch',
  'http-proxy', 'http-proxy-middleware', 'express-http-proxy',
  'connect', 'serve-handler', 'sirv-cli', 'http-server',
  'json-server', 'miragejs', 'mockoon',
  'needle', 'phin', 'bent', 'centra',

  // ---------------------------------------------------------------------------
  // Utility libraries
  // ---------------------------------------------------------------------------
  'lodash', 'lodash-es', 'lodash.get', 'lodash.set', 'lodash.merge',
  'lodash.clonedeep', 'lodash.debounce', 'lodash.throttle',
  'lodash.isempty', 'lodash.isequal', 'lodash.pick', 'lodash.omit',
  'lodash.uniq', 'lodash.flatten', 'lodash.camelcase',
  'underscore', 'ramda', 'immer', 'immutable',
  'uuid', 'nanoid', 'shortid', 'cuid', 'ulid',
  'deepmerge', 'deep-equal', 'fast-deep-equal', 'object-assign',
  'just-debounce-it', 'just-throttle', 'just-clone',
  'change-case', 'camelcase', 'snake-case', 'param-case',
  'pluralize', 'humanize-string', 'titleize', 'decamelize',
  'type-is', 'is-plain-object', 'is-number', 'is-string',
  'escape-string-regexp', 'escape-html', 'he', 'entities',
  'defu', 'destr', 'klona', 'rfdc',
  'invariant', 'tiny-invariant', 'warning',

  // ---------------------------------------------------------------------------
  // CLI tools & frameworks
  // ---------------------------------------------------------------------------
  'chalk', 'colors', 'picocolors', 'colorette', 'ansi-colors',
  'commander', 'yargs', 'meow', 'inquirer', 'prompts',
  'cac', 'citty', 'cleye', 'caporal',
  'ora', 'listr', 'listr2', 'progress', 'cli-progress',
  'figlet', 'boxen', 'cli-table3', 'table',
  'terminal-link', 'open', 'opn',
  'update-notifier', 'pkg-up', 'read-pkg', 'read-pkg-up',
  'find-up', 'locate-path', 'resolve-from', 'import-from',
  'execa', 'shelljs', 'cross-spawn', 'cross-env',
  'which', 'shx', 'npm-run-all', 'concurrently',
  'cfonts', 'gradient-string', 'log-symbols', 'cli-spinners',
  'wrap-ansi', 'slice-ansi', 'cliui', 'y18n',
  'arg', 'mri', 'minimist', 'nopt',

  // ---------------------------------------------------------------------------
  // Logging libraries
  // ---------------------------------------------------------------------------
  'winston', 'winston-daily-rotate-file', 'winston-transport',
  'pino', 'pino-pretty', 'pino-http',
  'bunyan', 'morgan', 'debug',
  'log4js', 'loglevel', 'signale',
  'consola', 'npmlog', 'fancy-log', 'roarr',
  'tslog', 'tracer', 'electron-log',

  // ---------------------------------------------------------------------------
  // Database / ORM
  // ---------------------------------------------------------------------------
  'mongoose', 'mongoose-paginate-v2', 'mongoose-lean-virtuals',
  'sequelize', 'sequelize-cli', 'sequelize-typescript',
  'typeorm', 'typeorm-naming-strategies',
  'prisma', '@prisma/client', 'prisma-client-js',
  'knex', 'objection', 'bookshelf',
  'drizzle-orm', 'drizzle-kit',
  'mikro-orm', '@mikro-orm/core', '@mikro-orm/postgresql',
  'pg', 'pg-pool', 'pg-promise', 'pg-cursor',
  'mysql', 'mysql2', 'mariadb',
  'sqlite3', 'better-sqlite3', 'sql.js',
  'redis', 'ioredis', 'redis-om',
  'mongodb', 'mongodb-memory-server',
  'cassandra-driver', 'couchbase', 'nano', 'pouchdb',
  'nedb', 'lowdb', 'level', 'levelup', 'leveldown',
  'dexie', 'idb', 'localforage',
  'elasticsearch', '@elastic/elasticsearch',
  'mssql', 'tedious', 'oracledb',
  'kysely', 'slonik', 'massive',
  'typegoose', '@typegoose/typegoose',
  'waterline', 'sails',

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  'zod', 'joi', 'yup', 'ajv', 'class-validator',
  'superstruct', 'io-ts', 'runtypes', 'ow',
  'validator', 'express-validator',
  'fastest-validator', 'fluent-json-schema',
  'valibot', 'typebox', '@sinclair/typebox',
  'class-transformer', 'json-schema', 'tv4',
  'is-my-json-valid', 'schema-utils',

  // ---------------------------------------------------------------------------
  // Security / auth
  // ---------------------------------------------------------------------------
  'jsonwebtoken', 'bcrypt', 'bcryptjs', 'passport',
  'helmet', 'cors', 'csurf', 'express-rate-limit',
  'jose', 'oauth', 'passport-jwt', 'passport-local',
  'passport-google-oauth20', 'passport-facebook', 'passport-github2',
  'express-jwt', 'jwks-rsa', 'node-jose',
  'csrf-csrf', 'hpp', 'xss-clean', 'express-mongo-sanitize',
  'rate-limiter-flexible', 'bottleneck',
  'speakeasy', 'otplib', 'node-2fa',
  'crypto-random-string', 'secure-random-password',
  'grant', 'oidc-provider', 'openid-client',
  '@auth/core', 'next-auth', 'lucia', 'arctic',
  'keycloak-js', 'auth0', '@auth0/auth0-react',
  'supertokens-node', 'clerk', '@clerk/nextjs',
  'iron-session', 'cookie-session', 'express-session',

  // ---------------------------------------------------------------------------
  // File / stream utilities
  // ---------------------------------------------------------------------------
  'fs-extra', 'graceful-fs', 'memfs', 'vinyl-fs',
  'glob', 'globby', 'fast-glob', 'picomatch', 'micromatch',
  'minimatch', 'multimatch', 'anymatch',
  'chokidar', 'watchpack', 'nsfw', 'fb-watchman',
  'rimraf', 'mkdirp', 'make-dir', 'del', 'trash',
  'copy', 'cpy', 'ncp', 'cpx',
  'archiver', 'tar', 'tar-fs', 'decompress', 'extract-zip',
  'adm-zip', 'jszip', 'yazl', 'yauzl',
  'multer', 'formidable', 'busboy', 'multiparty',
  'through2', 'highland', 'pump', 'pumpify',
  'concat-stream', 'get-stream', 'into-stream',
  'readable-stream', 'stream-buffers', 'bl',
  'vinyl', 'vinyl-source-stream', 'vinyl-buffer',
  'tmp', 'temp-dir', 'tempy', 'temp-write',
  'proper-lockfile', 'lockfile', 'write-file-atomic',
  'papaparse', 'csv-parse', 'csv-parser', 'fast-csv',
  'xlsx', 'exceljs', 'sheetjs',

  // ---------------------------------------------------------------------------
  // Template engines
  // ---------------------------------------------------------------------------
  'ejs', 'pug', 'handlebars', 'mustache', 'nunjucks',
  'hbs', 'eta', 'liquid', 'liquidjs', 'dot', 'art-template',
  'consolidate', 'marko', 'edge.js',

  // ---------------------------------------------------------------------------
  // Markdown / HTML parsing
  // ---------------------------------------------------------------------------
  'marked', 'markdown-it', 'remark', 'remark-html', 'remark-gfm',
  'rehype', 'rehype-stringify', 'rehype-raw',
  'unified', 'unist-util-visit',
  'gray-matter', 'front-matter',
  'cheerio', 'jsdom', 'htmlparser2', 'parse5',
  'dompurify', 'isomorphic-dompurify', 'sanitize-html', 'xss',
  'turndown', 'showdown', 'snarkdown',
  'mdx', '@mdx-js/react', '@mdx-js/loader',
  'mdast-util-from-markdown', 'micromark',
  'highlight.js', 'prismjs', 'shiki',

  // ---------------------------------------------------------------------------
  // Config / env
  // ---------------------------------------------------------------------------
  'dotenv', 'dotenv-expand', 'dotenv-flow', 'dotenv-safe',
  'config', 'convict', 'nconf', 'rc',
  'cosmiconfig', 'lilconfig',
  'cross-env', 'env-cmd', 'envalid', 'znv',
  'c12', 'unconfig', 'jiti',

  // ---------------------------------------------------------------------------
  // Process / task management
  // ---------------------------------------------------------------------------
  'concurrently', 'npm-run-all', 'npm-run-all2',
  'execa', 'shelljs', 'cross-spawn', 'child-process-promise',
  'pm2', 'nodemon', 'ts-node-dev', 'node-dev',
  'forever', 'supervisor',
  'workerpool', 'piscina', 'tinypool',
  'throng', 'sticky-cluster',
  'signal-exit', 'exit-hook', 'async-exit-hook',
  'tasuku',

  // ---------------------------------------------------------------------------
  // Crypto / encoding
  // ---------------------------------------------------------------------------
  'crypto-js', 'argon2', 'base64-js', 'buffer',
  'tweetnacl', 'libsodium-wrappers', 'sodium-native',
  'hash.js', 'sha.js', 'md5', 'sha1', 'sha256',
  'scrypt-js', 'pbkdf2',
  'base64url', 'base-x', 'bs58', 'bech32',
  'uint8arrays', 'multihashes', 'multibase',
  'elliptic', 'secp256k1', 'noble-secp256k1',
  'node-forge', 'openpgp', 'sshpk',
  'jsencrypt', 'node-rsa',

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------
  'ws', 'socket.io', 'socket.io-client',
  'sockjs', 'sockjs-client', 'faye-websocket',
  'primus', 'engine.io', 'engine.io-client',
  'uWebSockets.js', 'websocket', 'isomorphic-ws',
  'reconnecting-websocket', '@trpc/server', '@trpc/client',
  '@trpc/react-query', '@trpc/next',

  // ---------------------------------------------------------------------------
  // GraphQL
  // ---------------------------------------------------------------------------
  'graphql', 'graphql-tag', 'graphql-tools',
  'apollo-server', 'apollo-server-express', 'apollo-server-core',
  '@apollo/client', '@apollo/server', '@apollo/gateway',
  '@apollo/federation', '@apollo/subgraph',
  'graphql-yoga', 'mercurius', 'type-graphql',
  'nexus', 'pothos', '@pothos/core',
  'graphql-request', 'graphql-ws', 'graphql-subscriptions',
  'graphql-scalars', 'graphql-upload', 'graphql-relay',
  'graphql-shield', 'graphql-middleware', 'graphql-depth-limit',
  'urql', '@urql/core', '@urql/exchange-graphcache',
  'dataloader', 'graphql-codegen',
  '@graphql-codegen/cli', '@graphql-codegen/typescript',
  'genql', 'gql-tag-operations-preset',

  // ---------------------------------------------------------------------------
  // CSS-in-JS / styling
  // ---------------------------------------------------------------------------
  'styled-components', 'emotion', '@emotion/react', '@emotion/styled',
  '@emotion/css', '@emotion/server', '@emotion/cache',
  'tailwindcss', '@tailwindcss/forms', '@tailwindcss/typography',
  '@tailwindcss/aspect-ratio', '@tailwindcss/container-queries',
  'postcss', 'postcss-preset-env', 'postcss-import', 'postcss-nested',
  'postcss-modules', 'postcss-loader',
  'autoprefixer', 'cssnano', 'postcss-flexbugs-fixes',
  'sass', 'node-sass', 'sass-loader', 'less', 'less-loader',
  'css-loader', 'style-loader', 'css-modules-typescript-loader',
  'styled-jsx', 'linaria', '@linaria/core', 'vanilla-extract',
  '@vanilla-extract/css', '@vanilla-extract/recipes',
  'stitches', '@stitches/react',
  'classnames', 'clsx', 'cva', 'class-variance-authority',
  'tailwind-merge', 'tailwind-variants',
  'stylis', 'polished', 'color', 'tinycolor2',
  'normalize.css', 'modern-normalize', 'sanitize.css',
  'windicss', 'unocss',

  // ---------------------------------------------------------------------------
  // State management
  // ---------------------------------------------------------------------------
  'mobx', 'mobx-react', 'mobx-react-lite', 'mobx-state-tree',
  'zustand', 'jotai', 'recoil', 'valtio', 'xstate',
  'effector', 'effector-react', 'nanostores',
  '@preact/signals', '@preact/signals-react',
  'ngrx', '@ngrx/store', '@ngrx/effects',
  'akita', '@datorama/akita',
  'legend-state', 'pullstate',

  // ---------------------------------------------------------------------------
  // Animation / UI component libraries
  // ---------------------------------------------------------------------------
  'framer-motion', 'react-spring', 'react-motion',
  'gsap', 'animejs', 'anime', 'popmotion', 'motion',
  'lottie-web', 'lottie-react', 'react-lottie',
  'velocity-animate', 'animate.css',
  '@headlessui/react', '@headlessui/vue',
  '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-popover', '@radix-ui/react-tooltip',
  '@radix-ui/react-select', '@radix-ui/react-tabs',
  '@radix-ui/react-accordion', '@radix-ui/react-checkbox',
  '@radix-ui/react-slider', '@radix-ui/react-switch',
  '@radix-ui/react-avatar', '@radix-ui/react-scroll-area',
  'antd', 'ant-design-vue',
  '@ant-design/icons', '@ant-design/pro-components',
  'bootstrap', 'react-bootstrap',
  '@chakra-ui/react', '@chakra-ui/icons',
  'primereact', 'primevue',
  'element-plus', 'element-ui',
  'semantic-ui-react', 'semantic-ui-css',
  'rsuite', 'blueprint', '@blueprintjs/core',
  'react-aria-components', 'ariakit',
  'flowbite', 'flowbite-react', 'daisyui',
  'mantine', '@mantine/core', '@mantine/hooks',
  '@mantine/form', '@mantine/notifications',
  'shadcn-ui', 'cmdk',

  // ---------------------------------------------------------------------------
  // Image processing
  // ---------------------------------------------------------------------------
  'sharp', 'jimp', 'canvas', 'fabric',
  'pngjs', 'jpeg-js', 'bmp-js',
  'image-size', 'probe-image-size',
  'gm', 'imagemin', 'imagemin-pngquant', 'imagemin-mozjpeg',
  'responsive-loader', 'next-optimized-images',
  'blurhash', 'plaiceholder',
  'qrcode', 'jsqr', 'bwip-js',
  'pica', 'cropperjs', 'react-cropper',
  'exif-parser', 'piexifjs',
  'svg-captcha', 'svgo', 'svg-parser',
  '@svgr/core', '@svgr/webpack',

  // ---------------------------------------------------------------------------
  // Email / messaging
  // ---------------------------------------------------------------------------
  'nodemailer', 'nodemailer-sendgrid-transport',
  '@sendgrid/mail', '@sendgrid/client',
  'mailgun-js', '@mailgun/mailgun-js',
  'postmark', '@postmark/postmark',
  'email-templates', 'mjml',
  'react-email', '@react-email/components',
  'juice', 'html-to-text',
  'twilio', 'vonage', '@vonage/server-sdk',
  'firebase-admin', 'web-push', 'onesignal-node',
  '@slack/web-api', '@slack/bolt',
  'discord.js', 'telegraf', 'node-telegram-bot-api',
  'whatsapp-web.js',

  // ---------------------------------------------------------------------------
  // Cloud SDKs — AWS
  // ---------------------------------------------------------------------------
  'aws-sdk', '@aws-sdk/client-s3', '@aws-sdk/client-dynamodb',
  '@aws-sdk/client-sqs', '@aws-sdk/client-sns',
  '@aws-sdk/client-lambda', '@aws-sdk/client-ses',
  '@aws-sdk/client-iam', '@aws-sdk/client-ec2',
  '@aws-sdk/client-ecs', '@aws-sdk/client-cloudformation',
  '@aws-sdk/client-cloudwatch', '@aws-sdk/client-secrets-manager',
  '@aws-sdk/client-ssm', '@aws-sdk/client-sts',
  '@aws-sdk/client-cognito-identity-provider',
  '@aws-sdk/client-kms', '@aws-sdk/client-kinesis',
  '@aws-sdk/lib-dynamodb', '@aws-sdk/s3-request-presigner',
  '@aws-sdk/credential-providers', '@aws-sdk/smithy-client',
  'aws-amplify', '@aws-amplify/ui-react',
  'serverless', 'serverless-offline', 'serverless-webpack',
  'aws-cdk-lib', 'constructs',
  'sst', '@serverless-stack/resources',

  // ---------------------------------------------------------------------------
  // Cloud SDKs — GCP
  // ---------------------------------------------------------------------------
  '@google-cloud/storage', '@google-cloud/firestore',
  '@google-cloud/pubsub', '@google-cloud/bigquery',
  '@google-cloud/functions-framework', '@google-cloud/logging',
  '@google-cloud/secret-manager', '@google-cloud/tasks',
  '@google-cloud/translate', '@google-cloud/vision',
  '@google-cloud/text-to-speech', '@google-cloud/speech',
  'firebase', 'firebase-admin', 'firebase-functions',
  'firebase-tools', '@firebase/app', '@firebase/auth',
  '@firebase/firestore', '@firebase/storage',
  'googleapis', 'google-auth-library',

  // ---------------------------------------------------------------------------
  // Cloud SDKs — Azure / misc cloud
  // ---------------------------------------------------------------------------
  '@azure/storage-blob', '@azure/identity', '@azure/keyvault-secrets',
  '@azure/cosmos', '@azure/service-bus', '@azure/event-hubs',
  '@azure/functions', '@azure/msal-node', '@azure/msal-browser',
  '@azure/msal-react', '@azure/core-rest-pipeline',
  'supabase', '@supabase/supabase-js', '@supabase/auth-helpers-nextjs',
  'cloudflare', '@cloudflare/workers-types', 'wrangler',
  'vercel', '@vercel/analytics', '@vercel/og', '@vercel/kv',
  'netlify-cli', '@netlify/functions',
  'digitalocean', 'heroku',

  // ---------------------------------------------------------------------------
  // Monitoring / APM / error tracking
  // ---------------------------------------------------------------------------
  '@sentry/node', '@sentry/browser', '@sentry/react',
  '@sentry/nextjs', '@sentry/vue', '@sentry/tracing',
  'newrelic', '@newrelic/native-metrics',
  'prom-client', 'express-prom-bundle',
  'elastic-apm-node', '@elastic/apm-rum',
  'dd-trace', 'hot-shots',
  '@opentelemetry/api', '@opentelemetry/sdk-node',
  '@opentelemetry/sdk-trace-node', '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/instrumentation-http', '@opentelemetry/instrumentation-express',
  'applicationinsights', 'raygun', 'bugsnag',
  '@bugsnag/js', '@bugsnag/plugin-react',
  'rollbar', 'logrocket', 'posthog-js', 'posthog-node',
  'clinic', 'autocannon', '0x',

  // ---------------------------------------------------------------------------
  // Caching
  // ---------------------------------------------------------------------------
  'node-cache', 'lru-cache', 'quick-lru', 'tiny-lru',
  'keyv', '@keyv/redis', '@keyv/mongo',
  'cacheable-request', 'apicache',
  'memcached', 'catbox', '@hapi/catbox-redis',
  'flat-cache', 'file-system-cache', 'cache-manager',
  'stale-while-revalidate-cache',

  // ---------------------------------------------------------------------------
  // Queue / job processing
  // ---------------------------------------------------------------------------
  'bull', 'bullmq', 'bee-queue', 'agenda',
  'amqplib', 'amqp-connection-manager',
  'kafkajs', 'node-rdkafka',
  'celery-node', 'rsmq', 'sqs-consumer',
  'p-queue', 'p-limit', 'p-map', 'p-retry', 'p-throttle',
  'p-all', 'p-settle', 'p-props', 'p-event',
  'async', 'neo-async', 'fastq',
  'cron', 'node-cron', 'node-schedule', 'later',
  'bree', 'croner',

  // ---------------------------------------------------------------------------
  // Serialization / schema / data formats
  // ---------------------------------------------------------------------------
  'protobufjs', 'google-protobuf', '@grpc/grpc-js', '@grpc/proto-loader',
  'avro-js', 'avsc',
  'msgpack', 'msgpack-lite', '@msgpack/msgpack',
  'flatbuffers', 'cbor', 'bson',
  'yaml', 'js-yaml', 'toml', '@iarna/toml',
  'ini', 'json5', 'jsonc-parser', 'strip-json-comments',
  'qs', 'query-string', 'querystring', 'url-parse',
  'form-data', 'formdata-polyfill', 'multipart-parser',

  // ---------------------------------------------------------------------------
  // Date / time
  // ---------------------------------------------------------------------------
  'date-fns', 'date-fns-tz', 'dayjs', 'moment', 'moment-timezone',
  'luxon', 'ms', 'humanize-duration', 'pretty-ms',
  'chrono-node', 'spacetime', 'timeago.js',
  '@internationalized/date', 'fecha', 'dateformat',
  'rrule',

  // ---------------------------------------------------------------------------
  // Math / science / numbers
  // ---------------------------------------------------------------------------
  'mathjs', 'decimal.js', 'bignumber.js', 'big.js',
  'bn.js', 'fraction.js', 'currency.js',
  'dinero.js', 'accounting', 'numeral',
  'd3-scale', 'd3-array', 'd3-format',
  'simple-statistics', 'regression', 'ml-regression',
  'seedrandom', 'chance',

  // ---------------------------------------------------------------------------
  // Compression
  // ---------------------------------------------------------------------------
  'compression', 'pako', 'lz-string',
  'lz4', 'snappy', 'brotli', 'iltorb',
  'compressing', 'tar-stream', 'gunzip-maybe',
  'archiver', 'unzipper', 'node-gzip',

  // ---------------------------------------------------------------------------
  // Networking / DNS / low-level
  // ---------------------------------------------------------------------------
  'dns-packet', 'dns-over-http', 'native-dns',
  'ip', 'ip-address', 'cidr-matcher', 'ipaddr.js',
  'mac-address', 'public-ip', 'internal-ip',
  'is-online', 'is-reachable', 'ping', 'tcp-ping',
  'net-ping', 'raw-socket', 'pcap',
  'socks', 'socks-proxy-agent', 'https-proxy-agent',
  'http-proxy-agent', 'pac-proxy-agent', 'proxy-agent',
  'tunnel', 'global-agent', 'agent-base',
  'ssh2', 'node-ssh',
  'ftp', 'basic-ftp', 'ssh2-sftp-client',

  // ---------------------------------------------------------------------------
  // Package managers / monorepo tools
  // ---------------------------------------------------------------------------
  'npm', 'yarn', 'pnpm', 'bun',
  'lerna', 'nx', '@nrwl/workspace', '@nrwl/react', '@nrwl/node',
  'changesets', '@changesets/cli', '@changesets/changelog-github',
  'rush', '@microsoft/rush', 'bolt',
  'syncpack', 'ultra-runner', 'wireit',
  'verdaccio', 'npm-registry-fetch', 'pacote',
  'np', 'release-it', 'semantic-release', 'standard-version',
  'auto', 'bumpp', 'publish-please',

  // ---------------------------------------------------------------------------
  // Documentation
  // ---------------------------------------------------------------------------
  'typedoc', 'jsdoc', 'documentation',
  'docusaurus', '@docusaurus/core', '@docusaurus/preset-classic',
  'vuepress', 'vitepress', 'docsify', 'docsify-cli',
  'storybook', 'swagger-ui-express', 'swagger-jsdoc',
  'redoc', 'spectaql', 'apidoc',
  'compodoc', 'esdoc',

  // ---------------------------------------------------------------------------
  // Internationalization (i18n)
  // ---------------------------------------------------------------------------
  'i18next', 'react-i18next', 'i18next-http-backend',
  'i18next-browser-languagedetector', 'i18next-fs-backend',
  'vue-i18n', '@nuxtjs/i18n',
  'react-intl', '@formatjs/intl', '@formatjs/cli',
  'globalize', 'messageformat', 'gettext-parser',
  'polyglot', 'lingui', '@lingui/core', '@lingui/react',
  'rosetta', 'typesafe-i18n',
  'intl-messageformat', 'intl-pluralrules',

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------
  'axe-core', '@axe-core/react', '@axe-core/playwright',
  'pa11y', 'pa11y-ci', 'lighthouse',
  'eslint-plugin-jsx-a11y', 'react-axe',
  'ally.js', 'focus-trap', 'focus-trap-react', 'focus-visible',
  'aria-query', 'dom-accessibility-api',

  // ---------------------------------------------------------------------------
  // Editor / rich text
  // ---------------------------------------------------------------------------
  'prosemirror-state', 'prosemirror-view', 'prosemirror-model',
  'prosemirror-transform', 'prosemirror-commands',
  'tiptap', '@tiptap/core', '@tiptap/react', '@tiptap/vue-3',
  '@tiptap/starter-kit', '@tiptap/extension-link',
  'slate', 'slate-react', 'slate-history',
  'quill', 'react-quill', 'quill-delta',
  'draft-js', 'draftjs-to-html', 'react-draft-wysiwyg',
  'lexical', '@lexical/react',
  'tinymce', '@tinymce/tinymce-react',
  'ckeditor5', '@ckeditor/ckeditor5-react', '@ckeditor/ckeditor5-build-classic',
  'codemirror', '@codemirror/state', '@codemirror/view',
  '@codemirror/lang-javascript', '@codemirror/lang-python',
  'monaco-editor', '@monaco-editor/react',
  'ace-builds', 'react-ace',
  'editorjs', '@editorjs/editorjs',

  // ---------------------------------------------------------------------------
  // PDF / document generation
  // ---------------------------------------------------------------------------
  'pdfkit', 'pdf-lib', 'pdfjs-dist', 'react-pdf',
  'jspdf', 'jspdf-autotable', 'html2canvas', 'html2pdf.js',
  'docx', 'officegen', 'xlsx', 'exceljs',
  'pptxgenjs',
  'latex.js', 'katex', 'mathjax',
  'csv-writer', 'csv-stringify', 'fast-csv',

  // ---------------------------------------------------------------------------
  // Payment processing
  // ---------------------------------------------------------------------------
  'stripe', '@stripe/stripe-js', '@stripe/react-stripe-js',
  'paypal-rest-sdk', '@paypal/checkout-server-sdk',
  '@paypal/react-paypal-js', 'braintree', 'braintree-web',
  'square', 'adyen-api', 'razorpay',
  'coinbase-commerce-node', 'ethers', 'web3', 'web3-eth',
  '@solana/web3.js', 'bitcoinjs-lib',
  'commerce.js', 'snipcart', 'medusa-core',

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------
  'posthog-js', 'posthog-node',
  'mixpanel', 'mixpanel-browser',
  'amplitude-js', '@amplitude/analytics-browser',
  '@segment/analytics-next', 'analytics-node',
  'matomo-tracker', 'plausible-tracker',
  'react-ga', 'react-ga4', 'ga-4-react',
  'universal-analytics', '@google-analytics/data',
  'rudder-sdk-js',
  'launchdarkly-node-server-sdk',
  'statsig-node', 'growthbook', '@growthbook/growthbook-react',
  'flagsmith', 'unleash-client',

  // ---------------------------------------------------------------------------
  // CMS / headless CMS
  // ---------------------------------------------------------------------------
  'contentful', '@contentful/rich-text-react-renderer',
  'strapi', '@strapi/strapi', '@strapi/plugin-users-permissions',
  'sanity', '@sanity/client', '@sanity/image-url',
  'directus', '@directus/sdk',
  'ghost-admin-api', '@tryghost/content-api',
  'prismic', '@prismicio/client', '@prismicio/react',
  'storyblok-js-client', '@storyblok/react',
  'keystone', '@keystone-6/core',
  'payload', 'tinacms', 'decap-cms',
  'wpapi',
  'hygraph',

  // ---------------------------------------------------------------------------
  // SSR / SSG / meta-frameworks
  // ---------------------------------------------------------------------------
  'eleventy', '@11ty/eleventy',
  'hexo',
  'gridsome', 'scully', '@scullyio/init',
  'blitz', 'redwood', '@redwoodjs/core',
  'fresh', 'analog',

  // ---------------------------------------------------------------------------
  // DevOps / Docker / CI-CD
  // ---------------------------------------------------------------------------
  'dockerode', 'docker-compose',
  '@kubernetes/client-node',
  '@pulumi/aws', '@pulumi/gcp',
  '@actions/core', '@actions/github',
  '@actions/exec', '@actions/io', '@actions/cache',
  'danger', 'semantic-release',
  'env-ci', 'ci-info', 'is-ci',
  'dotenv-vault', 'infisical',

  // ---------------------------------------------------------------------------
  // Scoped popular — @types/*
  // ---------------------------------------------------------------------------
  '@types/node', '@types/react', '@types/react-dom',
  '@types/jest', '@types/mocha', '@types/chai',
  '@types/express', '@types/lodash', '@types/underscore',
  '@types/uuid', '@types/validator', '@types/semver',
  '@types/jsonwebtoken', '@types/bcrypt', '@types/bcryptjs',
  '@types/cors', '@types/helmet', '@types/morgan',
  '@types/multer', '@types/busboy', '@types/formidable',
  '@types/fs-extra', '@types/glob', '@types/rimraf', '@types/mkdirp',
  '@types/ws', '@types/qs', '@types/cookie-parser',
  '@types/body-parser', '@types/compression', '@types/serve-static',
  '@types/supertest', '@types/sinon', '@types/debug',
  '@types/mime', '@types/mime-types',
  '@types/cheerio', '@types/jsdom', '@types/luxon',
  '@types/inquirer', '@types/yargs', '@types/minimist',
  '@types/shelljs', '@types/through2', '@types/pump',
  '@types/pug', '@types/ejs', '@types/mustache',
  '@types/js-yaml', '@types/ini', '@types/json5',
  '@types/escape-html', '@types/http-errors',
  '@types/http-proxy', '@types/http-proxy-middleware',
  '@types/connect', '@types/koa', '@types/koa-router',
  '@types/passport', '@types/passport-jwt', '@types/passport-local',
  '@types/sharp', '@types/canvas', '@types/d3',
  '@types/three', '@types/jquery', '@types/backbone',
  '@types/async', '@types/bluebird',
  '@types/nodemailer', '@types/pg', '@types/mysql',

  // ---------------------------------------------------------------------------
  // Scoped popular — @mui/* (Material UI)
  // ---------------------------------------------------------------------------
  '@mui/material', '@mui/icons-material', '@mui/system',
  '@mui/lab', '@mui/styles', '@mui/x-date-pickers',
  '@mui/x-data-grid', '@mui/base', '@mui/joy',

  // ---------------------------------------------------------------------------
  // Scoped popular — @tanstack/*
  // ---------------------------------------------------------------------------
  '@tanstack/react-query', '@tanstack/react-query-devtools',
  '@tanstack/react-table', '@tanstack/react-virtual',
  '@tanstack/react-router', '@tanstack/query-core',
  '@tanstack/vue-query', '@tanstack/solid-query',
  '@tanstack/react-form',

  // ---------------------------------------------------------------------------
  // Scoped popular — @nestjs/*
  // ---------------------------------------------------------------------------
  '@nestjs/core', '@nestjs/common', '@nestjs/platform-express',
  '@nestjs/swagger', '@nestjs/typeorm', '@nestjs/mongoose',
  '@nestjs/jwt', '@nestjs/passport', '@nestjs/config',
  '@nestjs/graphql', '@nestjs/microservices', '@nestjs/websockets',
  '@nestjs/testing', '@nestjs/cli', '@nestjs/cqrs',
  '@nestjs/bull', '@nestjs/schedule', '@nestjs/throttler',

  // ---------------------------------------------------------------------------
  // Scoped popular — @next/*, @reduxjs/*, @octokit/*, misc ecosystem
  // ---------------------------------------------------------------------------
  '@next/font', '@next/mdx', '@next/bundle-analyzer',
  '@next/env', '@next/eslint-plugin-next',

  '@reduxjs/toolkit',

  '@octokit/core', '@octokit/rest', '@octokit/graphql',
  '@octokit/auth-token', '@octokit/request',

  '@sindresorhus/is', '@sindresorhus/slugify',

  '@t3-oss/env-nextjs', '@t3-oss/env-core',

  // ---------------------------------------------------------------------------
  // Visualization / charting
  // ---------------------------------------------------------------------------
  'd3', 'd3-selection', 'd3-scale', 'd3-shape', 'd3-axis',
  'd3-transition', 'd3-geo', 'd3-hierarchy',
  'chart.js', 'react-chartjs-2',
  'echarts', 'echarts-for-react',
  'three', '@react-three/fiber', '@react-three/drei',
  'highcharts', 'highcharts-react-official',
  'recharts', 'nivo', '@nivo/core', '@nivo/bar', '@nivo/line',
  'victory', 'victory-core',
  'plotly.js', 'react-plotly.js', 'vega', 'vega-lite',
  'apexcharts', 'react-apexcharts',
  'visx', '@visx/shape', '@visx/scale', '@visx/group',
  'mapbox-gl', 'react-map-gl', 'leaflet', 'react-leaflet',
  '@deck.gl/core', '@deck.gl/react',
  'ol', 'cesium', 'globe.gl',

  // ---------------------------------------------------------------------------
  // Forms / drag-and-drop
  // ---------------------------------------------------------------------------
  'formik', 'react-hook-form', '@hookform/resolvers',
  'final-form', 'react-final-form',
  'react-jsonschema-form', '@rjsf/core',
  'react-dnd', 'react-dnd-html5-backend',
  'react-beautiful-dnd', '@dnd-kit/core', '@dnd-kit/sortable',
  'sortablejs', 'vuedraggable', 'interact.js', 'dragula',

  // ---------------------------------------------------------------------------
  // Misc popular / low-level / legacy
  // ---------------------------------------------------------------------------
  'bluebird', 'q', 'when', 'rsvp',
  'async', 'neo-async',
  'semver', 'yargs-parser',
  'mime', 'mime-types', 'content-type', 'content-disposition',
  'body-parser', 'cookie-parser', 'cookie', 'tough-cookie',
  'compression', 'serve-static', 'serve-favicon',
  'http-errors', 'on-finished', 'raw-body',
  'path-to-regexp', 'path-parse', 'path-exists',
  'string-width', 'strip-ansi', 'ansi-regex', 'ansi-styles',
  'supports-color', 'has-flag', 'color-convert', 'color-name',
  'resolve', 'resolve-from', 'resolve-cwd', 'enhanced-resolve',
  'source-map', 'source-map-support', 'source-map-js',
  'acorn', 'acorn-walk', 'espree', 'esprima',
  'estree-walker', 'escodegen', 'recast', 'ast-types',
  'magic-string', 'merge-stream', 'merge2',
  'which', 'which-module', 'require-directory',
  'require-main-filename', 'set-blocking',
  'once', 'wrappy', 'inherits', 'util-deprecate',
  'graceful-fs', 'jsonfile', 'universalify',
  'lru-cache', 'yallist', 'minipass', 'minizlib',
  'whatwg-url', 'tr46', 'webidl-conversions',
  'iconv-lite', 'safer-buffer', 'string_decoder',
  'node-gyp', 'node-pre-gyp', 'prebuild-install', 'prebuildify',
  'nan', 'node-addon-api', 'napi-macros', 'bindings',
  'env-paths', 'xdg-basedir', 'os-tmpdir', 'os-homedir',
  'electron', 'electron-builder', 'electron-forge',
  'electron-store', 'electron-updater',
  'tauri', '@tauri-apps/api', '@tauri-apps/cli',
  'react-native', 'expo', 'expo-cli', 'expo-router',
  '@react-native-community/cli', 'react-native-web',
  'react-native-gesture-handler', 'react-native-reanimated',
  'react-native-screens', 'react-native-safe-area-context',
  '@react-navigation/native', '@react-navigation/stack',
  '@react-navigation/bottom-tabs',
  'nativescript', 'capacitor', '@capacitor/core', '@capacitor/cli',
  'ionic', '@ionic/core', '@ionic/react', '@ionic/vue',

  // ---------------------------------------------------------------------------
  // jQuery / legacy frameworks
  // ---------------------------------------------------------------------------
  'jquery', 'backbone', 'knockout', 'dojo',
  'mootools', 'prototype', 'zepto',
  'requirejs', 'systemjs', 'amd-loader',

  // ---------------------------------------------------------------------------
  // Deprecated / known-risky / compromised (useful for detection)
  // ---------------------------------------------------------------------------
  'event-stream', 'flatmap-stream', 'node-uuid',
  'coffee-script', 'coffeescript', 'bower',
  'uglify-js', 'terser', 'clean-css',
  'left-pad', 'is-promise', 'is-buffer',
  'ua-parser-js', 'coa', 'rc', 'colors',
  'node-ipc', 'peacenotwar', 'es5-ext',
  'faker', 'request', 'tslint',
  'node-pre-gyp', 'npm-lifecycle',
] as const;

// ---------------------------------------------------------------------------
// TyposquatDetector
// ---------------------------------------------------------------------------

export class TyposquatDetector {
  private readonly popularPackages: ReadonlySet<string>;
  private readonly popularList: readonly string[];

  constructor(extraPopularPackages?: string[]) {
    const combined = [...POPULAR_PACKAGES, ...(extraPopularPackages ?? [])];
    this.popularList = combined;
    this.popularPackages = new Set(combined);
  }

  /**
   * Async factory that creates a TyposquatDetector enriched with popular
   * packages fetched from the npm registry.
   *
   * The fetched list is cached locally (`~/.dep-oracle/popular-packages.json`)
   * with a 7-day TTL. If the fetch fails (offline, rate-limited, etc.) the
   * detector falls back to the hardcoded POPULAR_PACKAGES list only.
   *
   * Usage:
   * ```ts
   * const detector = await TyposquatDetector.createWithRegistry();
   * const result = detector.check('lod-ash');
   * ```
   */
  static async createWithRegistry(options?: {
    fetchPopular?: boolean;
  }): Promise<TyposquatDetector> {
    const shouldFetch = options?.fetchPopular ?? true;

    if (!shouldFetch) {
      return new TyposquatDetector();
    }

    const registryPackages = await fetchPopularPackages();
    return new TyposquatDetector(registryPackages);
  }

  /**
   * Check whether `packageName` looks like a typosquat of a popular package.
   * Returns risk assessment with details.
   */
  check(packageName: string): TyposquatResult {
    // If the package itself is a known popular package, it is safe
    if (this.popularPackages.has(packageName)) {
      return { isRisky: false, similarPackages: [], distance: 0 };
    }

    const similarPackages: string[] = [];
    let minDistance = Infinity;

    for (const popular of this.popularList) {
      const distance = levenshtein(packageName, popular);

      // Flag if Levenshtein distance is 1 or 2
      if (distance >= 1 && distance <= 2) {
        if (distance < minDistance) {
          minDistance = distance;
        }
        if (!similarPackages.includes(popular)) {
          similarPackages.push(popular);
        }
      }
    }

    // Also check common typosquat patterns even if Levenshtein > 2
    const patternMatches = this.checkTyposquatPatterns(packageName);
    for (const match of patternMatches) {
      if (!similarPackages.includes(match)) {
        similarPackages.push(match);
        const d = levenshtein(packageName, match);
        if (d < minDistance) {
          minDistance = d;
        }
      }
    }

    const isRisky = similarPackages.length > 0;

    return {
      isRisky,
      similarPackages: similarPackages.sort(),
      distance: isRisky ? minDistance : 0,
    };
  }

  // -------------------------------------------------------------------------
  // Pattern-based detection
  // -------------------------------------------------------------------------

  /**
   * Check for common typosquat patterns that may not be caught by
   * Levenshtein alone (e.g. adding -js, -node suffix).
   */
  private checkTyposquatPatterns(packageName: string): string[] {
    const matches: string[] = [];

    for (const popular of this.popularList) {
      // Skip exact matches
      if (packageName === popular) continue;

      // Pattern: added suffix (-js, -node, -lib, -pkg, -core)
      const suffixes = ['-js', '-node', '-lib', '-pkg', '-core', 'js', '-new'];
      for (const suffix of suffixes) {
        if (packageName === popular + suffix) {
          matches.push(popular);
          break;
        }
        if (packageName + suffix === popular) {
          matches.push(popular);
          break;
        }
      }

      // Pattern: doubled letters (e.g. "expresss" vs "express")
      if (this.isDoubledLetter(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: missing letter (e.g. "expres" vs "express")
      if (this.isMissingLetter(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: transposed adjacent letters (e.g. "exrpess" vs "express")
      if (this.isTransposed(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: homoglyph / common substitution (e.g. "1odash" vs "lodash")
      if (this.isHomoglyph(packageName, popular)) {
        matches.push(popular);
        continue;
      }
    }

    return matches;
  }

  /**
   * Check if `input` is `target` with one letter doubled.
   * e.g. "expresss" -> "express"
   */
  private isDoubledLetter(input: string, target: string): boolean {
    if (input.length !== target.length + 1) return false;

    let skipped = false;
    let j = 0;
    for (let i = 0; i < input.length; i++) {
      if (j >= target.length) {
        // Extra char at end — check it is the same as previous
        if (!skipped && i > 0 && input[i] === input[i - 1]) return true;
        return false;
      }
      if (input[i] === target[j]) {
        j++;
      } else if (!skipped && i > 0 && input[i] === input[i - 1]) {
        skipped = true;
        // Don't advance j — this is the doubled letter
      } else {
        return false;
      }
    }
    return j === target.length;
  }

  /**
   * Check if `input` is `target` with one letter removed.
   * e.g. "expres" -> "express"
   */
  private isMissingLetter(input: string, target: string): boolean {
    if (input.length !== target.length - 1) return false;

    let skipped = false;
    let j = 0;
    for (let i = 0; i < target.length; i++) {
      if (j >= input.length) {
        return !skipped;
      }
      if (input[j] === target[i]) {
        j++;
      } else if (!skipped) {
        skipped = true;
        // Skip this target char
      } else {
        return false;
      }
    }
    return j === input.length;
  }

  /**
   * Check if `input` is `target` with two adjacent letters swapped.
   * e.g. "exrpess" -> "express"
   */
  private isTransposed(input: string, target: string): boolean {
    if (input.length !== target.length) return false;

    let diffCount = 0;
    let firstDiff = -1;

    for (let i = 0; i < input.length; i++) {
      if (input[i] !== target[i]) {
        diffCount++;
        if (diffCount === 1) {
          firstDiff = i;
        } else if (diffCount === 2) {
          // Check if this is a transposition of adjacent characters
          if (
            i === firstDiff + 1 &&
            input[firstDiff] === target[i] &&
            input[i] === target[firstDiff]
          ) {
            // Valid transposition — continue checking the rest
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    return diffCount === 2;
  }

  /**
   * Check for common character substitutions (homoglyphs).
   * e.g. "1odash" vs "lodash", "rn" vs "m"
   */
  private isHomoglyph(input: string, target: string): boolean {
    if (input.length !== target.length) return false;

    const substitutions: Record<string, string[]> = {
      'l': ['1', 'i', '|'],
      'o': ['0'],
      '0': ['o'],
      '1': ['l', 'i'],
      'i': ['1', 'l'],
      'e': ['3'],
      's': ['5'],
      'a': ['4', '@'],
      'g': ['9'],
      'b': ['6'],
    };

    let subCount = 0;

    for (let i = 0; i < input.length; i++) {
      if (input[i] !== target[i]) {
        const allowed = substitutions[target[i]];
        if (allowed && allowed.includes(input[i])) {
          subCount++;
          if (subCount > 1) return false; // Only allow one substitution
        } else {
          return false;
        }
      }
    }

    return subCount === 1;
  }
}

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Uses the classic dynamic-programming approach with O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
  // Ensure `a` is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // Edge cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Previous and current row of distances
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  // Initialize the base row
  for (let i = 0; i <= m; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= n; j++) {
    curr[0] = j;

    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost, // substitution
      );
    }

    // Swap rows
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}
