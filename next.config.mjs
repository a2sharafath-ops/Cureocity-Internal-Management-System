/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow blood-report PDFs / progress photos
    },
  },
};

export default nextConfig;
