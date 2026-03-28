/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ["localhost:7777"] } }
}
module.exports = nextConfig
