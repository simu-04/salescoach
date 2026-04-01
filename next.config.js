/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads through API routes
  experimental: {
    serverComponentsExternalPackages: ['@deepgram/sdk', '@anthropic-ai/sdk'],
  },
}

module.exports = nextConfig
