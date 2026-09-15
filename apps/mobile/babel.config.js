module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo wires up the react-native-worklets plugin that
    // Reanimated 4 needs, so it must not be added again by hand.
    presets: ['babel-preset-expo'],
  };
};
