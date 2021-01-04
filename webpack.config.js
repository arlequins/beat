const webpack = require('webpack')
const path = require('path')

// S: REQUIRED PLUGINS
const CopyPlugin = require("copy-webpack-plugin")
const HtmlWebPackPlugin = require('html-webpack-plugin')
const { InjectManifest } = require('workbox-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { WebpackManifestPlugin } = require('webpack-manifest-plugin')
// E: REQUIRED PLUGINS

// S: constants
const VERSION = require('./package.json').version
const EXECUTE_ENV_ARGV = process.argv ? process.argv.find(str => str.startsWith('--env=')) : ''
const EXECUTE_ENV = EXECUTE_ENV_ARGV.length > 0 ? EXECUTE_ENV_ARGV.replace('--env=', '') : 'development'
const IS_DEVELOPMENT = EXECUTE_ENV === 'development'
const IS_SSR = EXECUTE_ENV === 'ssr'
const EXECUTE_MODE = EXECUTE_ENV === 'production' || IS_SSR ? 'production' : 'development'
// E: constants

// S: plugins
const CUSTOM_NODE_ENV = {
  VERSION: VERSION,
  NODE_ENV: EXECUTE_ENV,
}

const PLUGINS_LIST = [
  new WebpackManifestPlugin({
    fileName: 'assets.json',
    basePath: ''
  }),
  new HtmlWebPackPlugin({
    title: 'title',
    template: path.join(__dirname, 'src', 'assets', 'html', 'index.html'),
    filename: path.join('index.html'),
  }),
  new webpack.EnvironmentPlugin({
    ...CUSTOM_NODE_ENV,
  }),
  new CopyPlugin({
    patterns: [
      {
        from: path.join(__dirname, 'src', 'assets', 'images'),
        to: path.join(__dirname, 'dist', 'assets', VERSION, 'images'),
      },
      {
        from: path.join(__dirname, 'src', 'assets', 'static'),
        to: path.join(__dirname, 'dist', 'static'),
      },
      {
        from: path.join(__dirname, 'src', 'assets', 'root'),
        to: path.join(__dirname, 'dist'),
      },
    ],
  }),
]

const ALL_PLUGINS_LIST = IS_DEVELOPMENT ? [
  ...PLUGINS_LIST,
] : [
  !IS_SSR && new InjectManifest({
    swSrc: path.join(__dirname, 'src', 'client', 'sw.ts'),
    swDest: path.join(__dirname, 'service-worker.js'),
    maximumFileSizeToCacheInBytes: 7e+6,
    // Ignore all URL parameters.
    // exclude: [/.*/],
  }),
  new CleanWebpackPlugin({
    allowExternal: false,
    exclude:  [],
    verbose:  false,
    dry:      false,
  }),
  ...PLUGINS_LIST,
].filter(Boolean)
// E: plugins

module.exports = !IS_SSR ? {
  mode: EXECUTE_MODE,
  entry: {
    'polyfill': [
      'react-app-polyfill/ie11',
      'react-app-polyfill/stable',
    ],
    'app': IS_DEVELOPMENT ? path.join(__dirname, 'src', 'client', 'index.development') : path.join(__dirname, 'src', 'client', 'index.production'),
  },
  output: {
    path: path.join(__dirname, '.', 'dist'),
    filename: IS_DEVELOPMENT ? `assets/${VERSION}/beat/[name].[fullhash].js` : `assets/${VERSION}/beat/[name].[contenthash].js`,
    chunkFilename: IS_DEVELOPMENT ? `assets/${VERSION}/beat/chunk-[name].[fullhash].js` : `assets/${VERSION}/beat/chunk-[name].[contenthash].js`,
    publicPath: IS_DEVELOPMENT ? `http://localhost:5000/` : `/`,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    mainFields: ['module', 'browser', 'main'],
    alias: {
      client: path.resolve(__dirname, 'src/client/'),
      assets: path.resolve(__dirname, 'src/assets/'),
      types: path.resolve(__dirname, 'types/'),
      scss: path.resolve(__dirname, 'src/assets/scss/'),
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|tsx)$/,
        include: [ /src\/js/, /node_modules\/axios/ ],
        exclude: /node_modules/,
        use: [
          !IS_DEVELOPMENT && {
            loader: 'babel-loader',
            options: {
              plugins: [
                '@babel/plugin-syntax-dynamic-import',
              ]
            }
          }
        ].filter(Boolean)
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              happyPackMode: true,
              configFile: 'tsconfig.json',
            }
          }
        ]
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader'
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [
          {
            loader: 'tslint-loader',
            options: {
              configFile: 'tslint.json',
              tsConfigFile: 'tsconfig.json'
            },
          }
        ],
      },
      {
        test: /\.md$/i,
        use: 'raw-loader',
      },
    ]
  },
  plugins: ALL_PLUGINS_LIST,
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: 4,
        terserOptions: {
          ecma: 5,
          warnings: false,
          parse: {},
          compress: {},
          mangle: true, // Note `mangle.properties` is `false` by default.
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: undefined,
          keep_fnames: false,
          safari10: false,
        },
      }),
    ],
    splitChunks: {
      chunks: 'async',
      maxSize: 20000,
      minSize: 0,
      minChunks: 1,
      maxAsyncRequests: 10,
      maxInitialRequests: 10,
      automaticNameDelimiter: '~',
      name: false, // if true auto splits
      cacheGroups: {
        vendor: {
          test: path.resolve(process.cwd(), 'node_modules'),
          name: 'vendor',
          chunks: 'initial',
          priority: -10,
          enforce: true,
          minChunks: 1,
        },
        default: {
          minChunks: 1,
          priority: -20,
          reuseExistingChunk: true,
        },
      }
    },
    runtimeChunk: false,
  },
  devServer: {
    compress: true,
    contentBase: [
      path.join(__dirname, 'src', 'assets'),
    ],
    watchContentBase: true,
    hot: true,
    inline: true,
    historyApiFallback: {
      rewrites: [
        { from: /^\/$/, to: '/index.html' },
      ]
    },
    stats: 'minimal',
    // openPage: ``,
    publicPath: `/`,
    port: '5000',
  },
  performance: {
    maxEntrypointSize: 128000,
    maxAssetSize: 128000,
    hints: false
  }
} : {
  mode: 'production',
  entry: {
    'app': path.join(__dirname, 'src', 'client', 'index.ssr'),
  },
  output: {
    path: path.join(__dirname, '.', 'dist'),
    filename: `src/[name].js`,
    chunkFilename: `src/chunk-[name].js`,
    publicPath: `/`,
    library: 'beat',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    mainFields: ['module', 'browser', 'main'],
    alias: {
      client: path.resolve(__dirname, 'src/client/'),
      assets: path.resolve(__dirname, 'src/assets/'),
      types: path.resolve(__dirname, 'types/'),
      scss: path.resolve(__dirname, 'src/assets/scss/'),
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|tsx)$/,
        include: [ /src\/js/, /node_modules\/axios/ ],
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [
                '@babel/plugin-syntax-dynamic-import',
              ]
            }
          }
        ]
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: false,
              happyPackMode: false,
              configFile: 'tsconfig-ssr.json',
            }
          }
        ]
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: 'source-map-loader'
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [
          {
            loader: 'tslint-loader',
            options: {
              configFile: 'tslint.json',
              tsConfigFile: 'tsconfig-ssr.json'
            },
          }
        ],
      },
      {
        test: /\.md$/i,
        use: 'raw-loader',
      },
    ]
  },
  plugins: ALL_PLUGINS_LIST,
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: 4,
        terserOptions: {
          ecma: 5,
          warnings: false,
          parse: {},
          compress: {},
          mangle: true, // Note `mangle.properties` is `false` by default.
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: undefined,
          keep_fnames: false,
          safari10: false,
        },
      }),
    ],
  },
  performance: {
    maxEntrypointSize: 128000,
    maxAssetSize: 128000,
    hints: false
  }
}
