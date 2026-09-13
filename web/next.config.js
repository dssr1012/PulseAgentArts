/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'localhost'],
  },
  allowedDevOrigins: ['159.138.118.60'],
};

module.exports = nextConfig;