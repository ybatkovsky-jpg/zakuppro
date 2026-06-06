import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Proxy /fastapi/* requests to the FastAPI backend.
  // This way the browser never needs to know the backend URL directly,
  // avoiding CORS issues and hardcoded URLs in client-side code.
  async rewrites() {
    const fastapiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
    return [
      {
        source: "/fastapi/:path*",
        destination: `${fastapiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
