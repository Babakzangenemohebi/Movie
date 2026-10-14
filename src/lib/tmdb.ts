export interface MediaItem {
  id: number;
  tmdbId: number;
  imdbId?: string;
  rank?: number;
  title: string;
  original_title: string;
  overview: string;
  cast: string[];
  director?: string;
  genres: string[];
  poster_url: string;
  backdrop_url: string;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  media_type: 'movie' | 'tv';
  isNewRelease?: boolean;
}

export type CatalogCategory =
  | 'now_playing'
  | 'trending'
  | 'recommended'
  | 'top_250_movies'
  | 'top_250_animations'
  | 'tv_trending'
  | 'genre';

export interface GenreOption {
  id: number;
  name: string;
  enName: string;
}

export const MOVIE_GENRES: GenreOption[] = [
  { id: 28, name: 'اکشن و رزمی', enName: 'Action' },
  { id: 878, name: 'علمی‌تخیلی', enName: 'Sci-Fi' },
  { id: 18, name: 'درام', enName: 'Drama' },
  { id: 53, name: 'هیجان‌انگیز و دلهره‌آور', enName: 'Thriller' },
  { id: 80, name: 'جنایی و گنگستری', enName: 'Crime' },
  { id: 9648, name: 'معمایی و رازآلود', enName: 'Mystery' },
  { id: 27, name: 'ترسناک', enName: 'Horror' },
  { id: 35, name: 'کمدی', enName: 'Comedy' },
  { id: 10749, name: 'عاشقانه', enName: 'Romance' },
  { id: 14, name: 'فانتزی', enName: 'Fantasy' },
  { id: 12, name: 'ماجراجویی', enName: 'Adventure' },
  { id: 10752, name: 'جنگی و تاریخی', enName: 'War' },
  { id: 37, name: 'وسترن', enName: 'Western' },
  { id: 99, name: 'مستند', enName: 'Documentary' },
];

// تبدیل لینک تصویر به پراکسی بدون فیلتر و پرسرعت Cloudflare (wsrv.nl)
export function toProxyImageUrl(url?: string, width = 500): string {
  if (!url) return 'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=500&output=webp';
  if (url.includes('wsrv.nl')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp`;
}

export async function fetchCatalogFromApi(params: {
  category?: CatalogCategory;
  genreId?: number;
  genreName?: string;
  page?: number;
  query?: string;
  similarToId?: number;
  mediaType?: 'movie' | 'tv';
  apiKey?: string;
}): Promise<{ items: MediaItem[]; source: string }> {
  const url = new URL('/api/movies', window.location.origin);
  if (params.category) url.searchParams.set('category', params.category);
  if (params.genreId) url.searchParams.set('genreId', String(params.genreId));
  if (params.genreName) url.searchParams.set('genreName', params.genreName);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.query?.trim()) url.searchParams.set('q', params.query.trim());
  if (params.similarToId) url.searchParams.set('similarToId', String(params.similarToId));
  if (params.mediaType) url.searchParams.set('mediaType', params.mediaType);
  if (params.apiKey?.trim()) url.searchParams.set('apiKey', params.apiKey.trim());

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('خطا در دریافت اطلاعات از سرور');
  return res.json();
}
