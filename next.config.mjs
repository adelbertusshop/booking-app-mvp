/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignoruje błędy TypeScript podczas npm run build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignoruje błędy ESLint podczas npm run build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
