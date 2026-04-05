/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow images from external domains (e.g., bank logos from Plaid)
  images: {
    domains: ['plaid.com', 'logo.clearbit.com'],
  },
  // Environment variables exposed to the browser (prefix with NEXT_PUBLIC_)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

module.exports = nextConfig
