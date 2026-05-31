import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@workspace/triage-engine'],
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      '.js':  ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
};
export default config;
