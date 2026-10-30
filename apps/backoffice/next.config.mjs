// Statik dışa aktarım (out/): Cloudflare Pages'e yüklenir, sunucu kodu yoktur.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // Paylaşılan paketler TypeScript kaynağı olarak dışa açılır.
  transpilePackages: ["@gina/api", "@gina/core"],
};

export default nextConfig;
