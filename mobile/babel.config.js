module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@types': './src/types',
            '@constants': './src/constants',
            '@store': './src/store',
            '@api': './src/api',
            '@services': './src/services',
            '@context': './src/context',
            '@navigation': './src/navigation',
            '@screens': './src/screens',
            '@components': './src/components',
            '@utils': './src/utils',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};