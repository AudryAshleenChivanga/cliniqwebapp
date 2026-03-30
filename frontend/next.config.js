/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

module.exports = nextConfig;
