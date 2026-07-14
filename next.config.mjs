/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const allowedOrigins = ['localhost:3000'];
try {
  const { host } = new URL(appUrl);
  if (host && host !== 'localhost:3000') allowedOrigins.push(host);
} catch {}

const nextConfig = {
  serverExternalPackages: ['pdfkit'],
  experimental: {
    serverActions: {
      allowedOrigins
    }
  }
};
export default nextConfig;
