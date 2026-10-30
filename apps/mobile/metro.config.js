const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Assets is not a pnpm package, so Expo does not discover it as a workspace.
// Watch it explicitly so new manifests and images resolve without a Metro restart.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), path.resolve(__dirname, "../../packages/assets")])];

// SVG dosyaları React bileşeni olarak içe aktarılır (packages/assets).
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...config.resolver.sourceExts, "svg"],
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
