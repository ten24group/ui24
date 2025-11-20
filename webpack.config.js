const path = require('path');
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    chunkFilename: '[name].[contenthash].js',
    libraryTarget: 'umd',
    globalObject: 'this',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ],
  },
  optimization: {
    splitChunks: {
      chunks: 'async',
      minSize: 50000,
      cacheGroups: {
        blocknote: {
          test: /[\\/]node_modules[\\/]@blocknote[\\/]/,
          name: 'blocknote',
          chunks: 'async',
          priority: 40,
          reuseExistingChunk: true,
        },
        plots: {
          test: /[\\/]node_modules[\\/]@ant-design[\\/]plots[\\/]/,
          name: 'charts',
          chunks: 'async',
          priority: 40,
          reuseExistingChunk: true,
        },
        proComponents: {
          test: /[\\/]node_modules[\\/]@ant-design[\\/]pro-components[\\/]/,
          name: 'pro-components',
          chunks: 'async',
          priority: 40,
          reuseExistingChunk: true,
        },
        dndKit: {
          test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
          name: 'dnd-kit',
          chunks: 'async',
          priority: 40,
          reuseExistingChunk: true,
        },
        imageCrop: {
          test: /[\\/]node_modules[\\/]antd-img-crop[\\/]/,
          name: 'image-crop',
          chunks: 'async',
          priority: 40,
          reuseExistingChunk: true,
        },
      },
    },
  },
  plugins: [new CompressionPlugin()],
  externals: {
    'react': 'react',
    'react-dom': 'react-dom',
    'antd': 'antd',
    'axios': 'axios',
    'react-router-dom': 'react-router-dom'
  },
  devServer: {
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
  }
};