const path = require("path");
const purview = require("purview");

const config = {
  entry: {
    main: "./assets/js/main.ts",
    purview: purview.scriptPath,
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build/assets/js"),
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          onlyCompileBundledFiles: true,
        },
      },
    ],
  },
};

config.mode = "development";
config.devServer = {
  headers: { "Access-Control-Allow-Origin": "*" },
};

module.exports = config;
