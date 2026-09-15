import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @kiasujobs/shared ships TypeScript source, so Next has to compile it.
  transpilePackages: ['@kiasujobs/shared'],
  reactStrictMode: true,
};

export default nextConfig;
