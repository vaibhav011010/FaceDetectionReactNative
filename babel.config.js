module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  plugins: [
    // If you’re using react-native-worklets-core (if required by your setup), add its plugin before reanimated:
    // 'react-native-worklets-core/plugin',
    [
      "react-native-reanimated/plugin",
      {
        globals: ["__scanFaces"],
      },
    ],
  ],
};
