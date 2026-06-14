import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@workspace/triage-engine'],
  // supabase-js uses Node.js APIs — keep it out of the Edge runtime
  serverExternalPackages: ['@supabase/supabase-js'],
  // ESLint warnings must not block production builds
  eslint: { ignoreDuringBuilds: true },
  webpack(webpackConfig) {
    webpackConfig.resolve.extensionAlias = {
      '.js':  ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
};
export default config;
