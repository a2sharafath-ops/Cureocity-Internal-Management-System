/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true, // runs instrumentation.ts on server boot (sets TZ)
    serverActions: {
      bodySizeLimit: "10mb", // allow blood-report PDFs / progress photos
    },
    // unpdf ships an ESM pdf.js build that uses `import.meta`; webpack can't
    // bundle that cleanly (warns "Critical dependency"). Loading it as a plain
    // Node module on the server sidesteps the bundler entirely — it's only ever
    // used server-side, to read an uploaded InBody PDF (lib/pdf-text.ts).
    serverComponentsExternalPackages: ["unpdf"],
  },
};

export default nextConfig;
