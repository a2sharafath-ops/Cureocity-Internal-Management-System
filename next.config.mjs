/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // unpdf ships an ESM pdf.js build that uses `import.meta`; webpack can't
  // bundle that cleanly. It is only loaded server-side for uploaded PDFs.
  serverExternalPackages: ["unpdf"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow blood-report PDFs / progress photos
    },
  },
};

export default nextConfig;
