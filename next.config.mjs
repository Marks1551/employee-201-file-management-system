/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in responses.
  poweredByHeader: false,
  // Gzip/Brotli-compress responses (default true, but explicit for deployment clarity).
  compress: true,
};

export default nextConfig;
