/** @type {import('next').NextMode} */
const nextConfig = {
  eslint: {
    // Ignoruje błędy ESLint podczas kompilacji (npm run build)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Opcjonalnie: ignoruje błędy TypeScript podczas kompilacji
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
