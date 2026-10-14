/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'wsrv.nl' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'ia.media-imdb.com' },
      { protocol: 'https', hostname: 'static.tvmaze.com' }
    ],
  },
};

export default nextConfig;
