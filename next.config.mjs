/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Wymusza brak blokowania builda na zbieraniu danych statycznych
  staticPageGenerationTimeout: 1000,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
