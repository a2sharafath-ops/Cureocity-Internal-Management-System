/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true, // runs instrumentation.ts on server boot (sets TZ)
    serverActions: {
      bodySizeLimit: "10mb", // allow blood-report PDFs / progress photos
    },
  },
};

export default nextConfig;
