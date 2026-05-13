import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/extract",
        destination: "http://127.0.0.1:8001/api/extract",
      },
    ];
  },
};

export default nextConfig;
