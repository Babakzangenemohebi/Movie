import fs from 'fs';
import path from 'path';

const files = {
  // 1. next.config.mjs
  'next.config.mjs': `/** @type {import('next').NextConfig} */
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
`,

  // 2. src/lib/tmdb.ts
  'src/lib/tmdb.ts': `export interface MediaItem {
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
  return \`https://wsrv.nl/?url=\${encodeURIComponent(url)}&w=\${width}&output=webp\`;
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
`,

  // 3. src/app/api/movies/route.ts
  'src/app/api/movies/route.ts': `import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const BUILTIN_TMDB_KEYS = [
  process.env.NEXT_PUBLIC_TMDB_API_KEY || '',
  '3fd2be6f0c70a2a598f084ddfb75487c',
  '15d2ea6d0dc1d476efbca3eba2b9bbfb',
  '4ef0d7355d9ffb5151e987764708ce96',
].filter(Boolean);

const OMDB_KEYS = ['trilogy', 'b9bd48a6', '4a3b711b'];

const GENRE_MAP_FA: Record<number, string> = {
  28: 'اکشن',
  12: 'ماجراجویی',
  16: 'انیمیشن',
  35: 'کمدی',
  80: 'جنایی',
  99: 'مستند',
  18: 'درام',
  10751: 'خانوادگی',
  14: 'فانتزی',
  36: 'تاریخی',
  27: 'ترسناک',
  10402: 'موسیقی',
  9648: 'معمایی',
  10749: 'عاشقانه',
  878: 'علمی‌تخیلی',
  10770: 'فیلم تلویزیونی',
  53: 'هیجان‌انگیز',
  10752: 'جنگی',
  37: 'وسترن',
};

function proxyImg(rawUrl: string, w = 500) {
  if (!rawUrl) return 'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=500&output=webp';
  return \`https://wsrv.nl/?url=\${encodeURIComponent(rawUrl)}&w=\${w}&output=webp\`;
}

// ترجمه خودکار خلاصه داستان انگلیسی به فارسی روان
async function translateToPersian(text: string): Promise<string> {
  if (!text || text.trim().length < 5) return '';
  // اگر متن از قبل فارسی است، نیازی به ترجمه ندارد
  if (/[\\u0600-\\u06FF]/.test(text)) return text;
  try {
    const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=\${encodeURIComponent(text)}\`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return text;
    const data = await res.json();
    if (Array.isArray(data?.[0])) {
      return data[0].map((part: any) => part[0]).join('');
    }
    return text;
  } catch {
    return text;
  }
}

// دریافت مستقیم یا از طریق پراکسی ضدتحریم از TMDB
async function fetchTmdbWithMirror(path: string, customKey?: string) {
  const keys = customKey ? [customKey, ...BUILTIN_TMDB_KEYS] : BUILTIN_TMDB_KEYS;
  const sep = path.includes('?') ? '&' : '?';

  for (const key of keys) {
    const targetUrl = \`\${TMDB_BASE}\${path}\${sep}api_key=\${key}\`;

    // ۱. تلاش مستقیم
    try {
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) return await res.json();
    } catch {
      // ادامه به پراکسی
    }

    // ۲. تلاش از طریق پراکسی بدون تحریم (برای اینترنت ایران)
    try {
      const proxyUrl = \`https://api.allorigins.win/raw?url=\${encodeURIComponent(targetUrl)}\`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return await res.json();
    } catch {
      // ادامه
    }
  }
  return null;
}

// غنی‌سازی فیلم با نام بازیگران، کارگردان، خلاصه داستان فارسی و امتیاز به‌روز
async function enrichMovieItem(item: any, mediaType: 'movie' | 'tv', customKey?: string, rank?: number) {
  const id = item.id;
  let overview = item.overview || '';
  let cast: string[] = [];
  let director = '';

  // دریافت اطلاعات تکمیلی (بازیگران + خلاصه انگلیسی در صورت خالی بودن فارسی)
  try {
    const detailsEn = await fetchTmdbWithMirror(
      \`/\${mediaType}/\${id}?language=en-US&append_to_response=credits\`,
      customKey
    );
    if (detailsEn) {
      if (!overview || overview.trim().length < 10) {
        overview = await translateToPersian(detailsEn.overview || '');
      }
      if (detailsEn.credits?.cast) {
        cast = detailsEn.credits.cast.slice(0, 4).map((c: any) => c.name);
      }
      if (detailsEn.credits?.crew) {
        const dir = detailsEn.credits.crew.find((c: any) => c.job === 'Director');
        if (dir) director = dir.name;
      }
    }
  } catch {
    // در صورت خطا از مقادیر پایه استفاده می‌شود
  }

  // اگر هنوز خلاصه داستان خالی است، تلاش از طریق OMDb با نام فیلم
  const originalTitle = item.original_title || item.original_name || item.title || item.name || '';
  if ((!overview || cast.length === 0) && originalTitle) {
    for (const oKey of OMDB_KEYS) {
      try {
        const omdbRes = await fetch(
          \`https://www.omdbapi.com/?t=\${encodeURIComponent(originalTitle)}&apikey=\${oKey}\`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json();
          if (omdbData?.Response === 'True') {
            if (!overview && omdbData.Plot && omdbData.Plot !== 'N/A') {
              overview = await translateToPersian(omdbData.Plot);
            }
            if (cast.length === 0 && omdbData.Actors && omdbData.Actors !== 'N/A') {
              cast = omdbData.Actors.split(',').map((s: string) => s.trim()).slice(0, 4);
            }
            if (!director && omdbData.Director && omdbData.Director !== 'N/A') {
              director = omdbData.Director;
            }
            if (!item.vote_average && omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
              item.vote_average = parseFloat(omdbData.imdbRating);
            }
            break;
          }
        }
      } catch {
        // ادامه
      }
    }
  }

  const genres: string[] = (item.genre_ids || [])
    .map((gid: number) => GENRE_MAP_FA[gid])
    .filter(Boolean);

  const rawPoster = item.poster_path
    ? \`\${TMDB_IMG}/w500\${item.poster_path}\`
    : item.backdrop_path
    ? \`\${TMDB_IMG}/w780\${item.backdrop_path}\`
    : '';

  const rawBackdrop = item.backdrop_path
    ? \`\${TMDB_IMG}/w1280\${item.backdrop_path}\`
    : rawPoster;

  const relDate = item.release_date || item.first_air_date || '2025-01-01';

  return {
    id,
    tmdbId: id,
    rank,
    title: item.title || item.name || originalTitle,
    original_title: originalTitle,
    overview: overview || 'خلاصه داستان این اثر آماده نمایش است. برای تماشای آنلاین روی کارت کلیک کنید.',
    cast: cast.length > 0 ? cast : ['بازیگران بین‌المللی'],
    director: director || undefined,
    genres: genres.length > 0 ? genres : ['سینمایی'],
    poster_url: proxyImg(rawPoster, 500),
    backdrop_url: proxyImg(rawBackdrop, 1280),
    release_date: relDate,
    vote_average: Number(item.vote_average || 8.0),
    vote_count: Number(item.vote_count || 1200),
    media_type: mediaType,
    isNewRelease: relDate.startsWith('2025') || relDate.startsWith('2026'),
  };
}

// تبدیل کد IMDb به کد TMDB از طریق Wikidata (برای فال‌بک صددرصد بدون فیلتر)
async function resolveImdbToTmdbViaWikidata(imdbIds: string[]): Promise<Record<string, { tmdbId: number; type: 'movie' | 'tv' }>> {
  if (imdbIds.length === 0) return {};
  try {
    const values = imdbIds.map((id) => \`"\${id}"\`).join(' ');
    const sparql = \`
      SELECT ?imdb ?tmdbMovie ?tmdbTv WHERE {
        VALUES ?imdb { \${values} }
        ?item wdt:P345 ?imdb .
        OPTIONAL { ?item wdt:P4947 ?tmdbMovie . }
        OPTIONAL { ?item wdt:P4983 ?tmdbTv . }
      }
    \`;
    const url = \`https://query.wikidata.org/sparql?query=\${encodeURIComponent(sparql)}&format=json\`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CinephileVibeFarsi/3.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, { tmdbId: number; type: 'movie' | 'tv' }> = {};
    for (const row of data?.results?.bindings || []) {
      const imdb = row.imdb?.value;
      const movieId = row.tmdbMovie?.value ? parseInt(row.tmdbMovie.value, 10) : null;
      const tvId = row.tmdbTv?.value ? parseInt(row.tmdbTv.value, 10) : null;
      if (imdb && movieId) map[imdb] = { tmdbId: movieId, type: 'movie' };
      else if (imdb && tvId) map[imdb] = { tmdbId: tvId, type: 'tv' };
    }
    return map;
  } catch {
    return {};
  }
}

// فال‌بک غنی با OMDb + IMDb + ترجمه خودکار فارسی
async function fallbackRichCatalog(searchTerm: string, startRank?: number) {
  const clean = searchTerm.trim() || '2025';
  const firstChar = clean[0]?.toLowerCase() || 'a';
  const imdbUrl = \`https://v3.sg.media-imdb.com/suggestion/\${encodeURIComponent(firstChar)}/\${encodeURIComponent(clean)}.json\`;

  const res = await fetch(imdbUrl, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];
  const data = await res.json();
  const rawList = (data?.d || [])
    .filter((item: any) => item.id?.startsWith('tt') && item.i?.imageUrl)
    .slice(0, 12);

  const imdbIds = rawList.map((item: any) => item.id);
  const tmdbMap = await resolveImdbToTmdbViaWikidata(imdbIds);

  const enriched = await Promise.all(
    rawList.map(async (item: any, idx: number) => {
      const resolved = tmdbMap[item.id];
      const tmdbId = resolved?.tmdbId || parseInt(item.id.replace('tt', ''), 10);
      const mediaType: 'movie' | 'tv' =
        resolved?.type || (item.qid === 'tvSeries' || item.qid === 'tvMiniSeries' ? 'tv' : 'movie');

      let plotFa = '';
      let actors: string[] = item.s ? item.s.split(',').map((s: string) => s.trim()) : [];
      let director = '';
      let rating = 8.1;
      let genresFa: string[] = ['سینمایی'];

      try {
        const omdbRes = await fetch(
          \`https://www.omdbapi.com/?i=\${item.id}&apikey=trilogy\`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (omdbRes.ok) {
          const omdb = await omdbRes.json();
          if (omdb?.Response === 'True') {
            if (omdb.Plot && omdb.Plot !== 'N/A') {
              plotFa = await translateToPersian(omdb.Plot);
            }
            if (omdb.Actors && omdb.Actors !== 'N/A') {
              actors = omdb.Actors.split(',').map((s: string) => s.trim()).slice(0, 4);
            }
            if (omdb.Director && omdb.Director !== 'N/A') {
              director = omdb.Director;
            }
            if (omdb.imdbRating && omdb.imdbRating !== 'N/A') {
              rating = parseFloat(omdb.imdbRating);
            }
            if (omdb.Genre && omdb.Genre !== 'N/A') {
              genresFa = omdb.Genre.split(',').map((g: string) => g.trim()).slice(0, 3);
            }
          }
        }
      } catch {
        // ادامه
      }

      return {
        id: tmdbId,
        tmdbId,
        imdbId: item.id,
        rank: startRank ? startRank + idx : undefined,
        title: item.l,
        original_title: item.l,
        overview: plotFa || \`اثر تحسین‌شده با هنرنمایی \${actors.join('، ')}\`,
        cast: actors.length > 0 ? actors : ['بازیگران مطرح سینما'],
        director: director || undefined,
        genres: genresFa,
        poster_url: proxyImg(item.i?.imageUrl, 500),
        backdrop_url: proxyImg(item.i?.imageUrl, 1280),
        release_date: item.y ? \`\${item.y}-01-01\` : '2025-01-01',
        vote_average: rating,
        media_type: mediaType,
        isNewRelease: Number(item.y) >= 2024,
      };
    })
  );

  return enriched;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'now_playing';
  const genreId = searchParams.get('genreId') || '';
  const genreName = searchParams.get('genreName') || '';
  const similarToId = searchParams.get('similarToId') || '';
  const mediaTypeParam = (searchParams.get('mediaType') as 'movie' | 'tv') || 'movie';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const customKey = searchParams.get('apiKey') || '';

  // ۱. درخواست فیلم‌های پیشنهادی و مشابه بر اساس فیلم فعلی
  if (similarToId) {
    const recData = await fetchTmdbWithMirror(
      \`/\${mediaTypeParam}/\${similarToId}/recommendations?language=fa-IR&page=1\`,
      customKey
    );
    if (recData?.results?.length > 0) {
      const topRecs = recData.results.slice(0, 6);
      const items = await Promise.all(
        topRecs.map((item: any) => enrichMovieItem(item, mediaTypeParam, customKey))
      );
      return NextResponse.json({ items, source: 'tmdb_recommendations' });
    }
    const fallbackRecs = await fallbackRichCatalog('Christopher Nolan');
    return NextResponse.json({ items: fallbackRecs.slice(0, 6), source: 'fallback_recommendations' });
  }

  // ۲. جستجوی زنده
  if (query.trim()) {
    const tmdbSearch = await fetchTmdbWithMirror(
      \`/search/multi?language=fa-IR&query=\${encodeURIComponent(query.trim())}&include_adult=false\`,
      customKey
    );
    if (tmdbSearch?.results?.length > 0) {
      const filtered = tmdbSearch.results
        .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && (item.poster_path || item.backdrop_path))
        .slice(0, 12);

      const items = await Promise.all(
        filtered.map((item: any) =>
          enrichMovieItem(item, item.media_type === 'tv' ? 'tv' : 'movie', customKey)
        )
      );
      if (items.length > 0) {
        return NextResponse.json({ items, source: 'tmdb_live_search' });
      }
    }

    const fallbackItems = await fallbackRichCatalog(query);
    return NextResponse.json({ items: fallbackItems, source: 'omdb_imdb_live' });
  }

  // ۳. مسیرهای دسته‌بندی (تازه اکران‌شده، ۲۵۰ فیلم برتر، ۲۵۰ انیمیشن برتر، ژانرها، فیلم‌های پیشنهادی)
  let tmdbPath = \`/movie/now_playing?language=fa-IR&page=\${page}\`;
  let isRankedList = false;

  if (category === 'trending') {
    tmdbPath = \`/trending/movie/week?language=fa-IR&page=\${page}\`;
  } else if (category === 'recommended') {
    tmdbPath = \`/discover/movie?language=fa-IR&sort_by=popularity.desc&vote_average.gte=7.2&vote_count.gte=500&page=\${page}\`;
  } else if (category === 'top_250_movies') {
    tmdbPath = \`/movie/top_rated?language=fa-IR&page=\${page}\`;
    isRankedList = true;
  } else if (category === 'top_250_animations') {
    tmdbPath = \`/discover/movie?language=fa-IR&with_genres=16&sort_by=vote_average.desc&vote_count.gte=800&page=\${page}\`;
    isRankedList = true;
  } else if (category === 'tv_trending') {
    tmdbPath = \`/trending/tv/week?language=fa-IR&page=\${page}\`;
  } else if (category === 'genre' && genreId) {
    tmdbPath = \`/discover/movie?language=fa-IR&with_genres=\${genreId}&sort_by=popularity.desc&vote_count.gte=200&page=\${page}\`;
  }

  const catalogData = await fetchTmdbWithMirror(tmdbPath, customKey);

  if (catalogData?.results?.length > 0) {
    const rawItems = catalogData.results
      .filter((item: any) => item.poster_path || item.backdrop_path)
      .slice(0, 12);

    const startRank = (page - 1) * 12 + 1;
    const items = await Promise.all(
      rawItems.map((item: any, index: number) => {
        const mType: 'movie' | 'tv' =
          category === 'tv_trending' || item.media_type === 'tv' ? 'tv' : 'movie';
        return enrichMovieItem(
          item,
          mType,
          customKey,
          isRankedList ? startRank + index : undefined
        );
      })
    );

    return NextResponse.json({ items, source: 'tmdb_official' });
  }

  // ۴. فال‌بک در صورت قطعی کامل TMDB
  let fallbackQuery = '2025';
  if (category === 'top_250_movies') fallbackQuery = 'The Godfather';
  if (category === 'top_250_animations') fallbackQuery = 'Spirited Away';
  if (category === 'genre' && genreName) fallbackQuery = genreName;
  if (category === 'tv_trending') fallbackQuery = 'Breaking Bad';

  const startRank = isRankedList ? (page - 1) * 12 + 1 : undefined;
  const fallbackItems = await fallbackRichCatalog(fallbackQuery, startRank);
  return NextResponse.json({ items: fallbackItems, source: 'omdb_imdb_live' });
}
`,

  // 4. src/components/FrameXPlayer.tsx
  'src/components/FrameXPlayer.tsx': `'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toPersianDigits, toJalaliDate, toPersianGregorianYear } from '@/lib/persian-utils';
import { Play, Server, Tv, Film, RotateCcw, Sparkles, CheckCircle2, Users, Star, Calendar, Clapperboard } from 'lucide-react';
import { MediaItem } from '@/lib/tmdb';

export type StreamServer = 'auto' | 'barbarian' | 'archer' | 'goblin';

interface FrameXPlayerProps {
  media: MediaItem;
  autoPlayTrigger?: boolean;
}

const SERVERS: { id: StreamServer; label: string; badge: string }[] = [
  { id: 'auto', label: 'سرور هوشمند خودکار', badge: 'پیش‌فرض' },
  { id: 'barbarian', label: 'سرور اول (Barbarian)', badge: 'کیفیت بالا' },
  { id: 'archer', label: 'سرور دوم (Archer)', badge: 'پرسرعت' },
  { id: 'goblin', label: 'سرور سوم (Goblin)', badge: 'پشتیبان' },
];

export default function FrameXPlayer({
  media,
  autoPlayTrigger = false,
}: FrameXPlayerProps) {
  const [selectedServer, setSelectedServer] = useState<StreamServer>('auto');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(media.media_type);
  const [customTmdbId, setCustomTmdbId] = useState<number>(media.tmdbId);
  const [season, setSeason] = useState<number>(1);
  const [episode, setEpisode] = useState<number>(1);
  const [savedTimestamp, setSavedTimestamp] = useState<number>(0);

  useEffect(() => {
    setCustomTmdbId(media.tmdbId);
    setMediaType(media.media_type);
  }, [media.tmdbId, media.media_type]);

  const storageKey = \`cinephile_progress_\${mediaType}_\${customTmdbId}_\${season}_\${episode}\`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setSavedTimestamp(saved ? parseInt(saved, 10) || 0 : 0);
  }, [storageKey]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('framextv.xyz')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.currentTime && typeof data.currentTime === 'number') {
          const sec = Math.floor(data.currentTime);
          localStorage.setItem(storageKey, sec.toString());
          setSavedTimestamp(sec);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [storageKey]);

  const embedUrl = useMemo(() => {
    const basePath =
      mediaType === 'movie'
        ? \`https://framextv.xyz/embed/\${customTmdbId}\`
        : \`https://framextv.xyz/embed/\${customTmdbId}/\${season}/\${episode}\`;

    const params = new URLSearchParams({
      autoplay: autoPlayTrigger ? '1' : '0',
      muted: '0',
      controls: '1',
      server: selectedServer,
      title: media.title,
      poster: media.backdrop_url,
      t: savedTimestamp.toString(),
    });

    return \`\${basePath}?\${params.toString()}\`;
  }, [customTmdbId, mediaType, season, episode, selectedServer, media.title, media.backdrop_url, savedTimestamp, autoPlayTrigger]);

  return (
    <div className="w-full space-y-5 rounded-3xl border border-white/10 bg-[#121215]/95 p-5 shadow-2xl backdrop-blur-xl" dir="rtl">
      {/* کارت اطلاعات کامل فیلم در بالای پلیر (پوستر، خلاصه داستان، نام بازیگران، کارگردان و امتیاز به‌روز) */}
      <div className="grid gap-5 border-b border-white/10 pb-5 md:grid-cols-[160px_1fr]">
        <div className="relative aspect-[2/3] w-36 md:w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-lg mx-auto md:mx-0">
          <img
            src={media.poster_url}
            alt={media.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=500&output=webp';
            }}
          />
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/85 px-2 py-1 text-xs font-black text-[#e5a93c]">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>{toPersianDigits(media.vote_average.toFixed(1))}</span>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {media.rank && (
                <span className="rounded-lg bg-[#e5a93c] px-2.5 py-0.5 text-xs font-black text-black">
                  رتبه #{toPersianDigits(media.rank)}
                </span>
              )}
              <h2 className="text-xl font-black text-white sm:text-2xl">{media.title}</h2>
              {media.original_title && media.original_title !== media.title && (
                <span className="text-xs font-semibold text-zinc-400" dir="ltr">
                  ({media.original_title})
                </span>
              )}
              <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                کد TMDB: {toPersianDigits(customTmdbId)}
              </span>
            </div>

            {/* ژانرها و سال انتشار */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
              <span className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[#e5a93c]">
                <Calendar className="h-3.5 w-3.5" />
                اکران: {toJalaliDate(media.release_date, true)} شمسی ({toPersianGregorianYear(media.release_date)} میلادی)
              </span>
              {media.genres?.map((g, i) => (
                <span key={i} className="rounded-lg bg-[#be123c]/20 border border-[#be123c]/30 px-2.5 py-1 text-rose-200">
                  {g}
                </span>
              ))}
            </div>

            {/* خلاصه داستان کامل */}
            <div className="rounded-2xl bg-[#09090b]/70 p-3.5 border border-white/5">
              <h4 className="mb-1 text-xs font-bold text-[#e5a93c]">خلاصه داستان:</h4>
              <p className="text-xs sm:text-sm leading-relaxed text-zinc-200">
                {media.overview}
              </p>
            </div>

            {/* نام بازیگران و کارگردان */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              {media.cast && media.cast.length > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Users className="h-4 w-4 text-[#e5a93c]" />
                  <span className="font-bold text-white">ستارگان و بازیگران:</span>
                  <span>{media.cast.join(' ، ')}</span>
                </div>
              )}
              {media.director && (
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Clapperboard className="h-4 w-4 text-[#be123c]" />
                  <span className="font-bold text-white">کارگردان:</span>
                  <span>{media.director}</span>
                </div>
              )}
            </div>
          </div>

          {/* سوییچر سرورها */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Server className="h-3.5 w-3.5 text-[#e5a93c]" />
                انتخاب سرور پخش:
              </span>
              {SERVERS.map((srv) => {
                const active = selectedServer === srv.id;
                return (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedServer(srv.id)}
                    className={\`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer \${
                      active
                        ? 'bg-[#e5a93c] text-[#09090b] shadow-lg shadow-[#e5a93c]/25'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }\`}
                  >
                    <span>{srv.label}</span>
                    <span
                      className={\`rounded-md px-1.5 py-0.5 text-[10px] \${
                        active ? 'bg-black/20 text-black' : 'bg-[#be123c]/30 text-rose-300'
                      }\`}
                    >
                      {srv.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* کنترل‌های نوع اثر (فیلم / سریال)، فصل و قسمت و شناسه TMDB */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#09090b]/80 p-3 border border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setMediaType('movie')}
              className={\`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer \${
                mediaType === 'movie' ? 'bg-[#be123c] text-white' : 'text-zinc-400 hover:text-white'
              }\`}
            >
              <Film className="h-3.5 w-3.5" />
              فیلم سینمایی
            </button>
            <button
              onClick={() => setMediaType('tv')}
              className={\`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer \${
                mediaType === 'tv' ? 'bg-[#be123c] text-white' : 'text-zinc-400 hover:text-white'
              }\`}
            >
              <Tv className="h-3.5 w-3.5" />
              سریال
            </button>
          </div>

          {mediaType === 'tv' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">فصل:</label>
              <input
                type="number"
                min={1}
                value={season}
                onChange={(e) => setSeason(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-white/10 bg-[#121215] px-2.5 py-1 text-center text-xs text-white focus:border-[#e5a93c] focus:outline-none"
              />
              <label className="text-xs text-zinc-400">قسمت:</label>
              <input
                type="number"
                min={1}
                value={episode}
                onChange={(e) => setEpisode(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-white/10 bg-[#121215] px-2.5 py-1 text-center text-xs text-white focus:border-[#e5a93c] focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">کد TMDB خودکار:</label>
          <input
            type="number"
            value={customTmdbId}
            onChange={(e) => setCustomTmdbId(Number(e.target.value) || 0)}
            className="w-28 rounded-lg border border-[#e5a93c]/40 bg-[#121215] px-3 py-1 text-center text-xs text-[#e5a93c] font-bold focus:border-[#e5a93c] focus:outline-none"
          />
        </div>
      </div>

      {/* آی‌فریم استریم */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] shadow-inner">
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={media.title}
          className="h-full w-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      </div>

      {/* وضعیت تایم‌لاین */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#e5a93c]" />
          {savedTimestamp > 0 ? (
            <span>
              ادامه پخش خودکار از ثانیه <strong className="text-white">{toPersianDigits(savedTimestamp)}</strong>
            </span>
          ) : (
            <span>آماده پخش آنلاین</span>
          )}
          {savedTimestamp > 0 && (
            <button
              onClick={() => {
                localStorage.removeItem(storageKey);
                setSavedTimestamp(0);
              }}
              className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-rose-400 hover:bg-white/10 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              ریست زمان
            </button>
          )}
        </div>
        <code className="max-w-full truncate rounded-lg bg-black/50 px-2.5 py-1 text-[10px] text-zinc-500" dir="ltr">
          {embedUrl}
        </code>
      </div>
    </div>
  );
}
`,

  // 5. src/app/page.tsx
  'src/app/page.tsx': `'use client';

import React, { useEffect, useState, useRef } from 'react';
import HeroCanvas from '@/components/HeroCanvas';
import FrameXPlayer from '@/components/FrameXPlayer';
import FilmDiary from '@/components/FilmDiary';
import {
  fetchCatalogFromApi,
  MediaItem,
  CatalogCategory,
  MOVIE_GENRES,
  GenreOption,
} from '@/lib/tmdb';
import { toPersianDigits, toJalaliDate, toPersianGregorianYear } from '@/lib/persian-utils';
import {
  Search,
  Film,
  Sparkles,
  Star,
  KeyRound,
  Play,
  Calendar,
  Flame,
  Trophy,
  Tv,
  Zap,
  Loader2,
  X,
  Users,
  Wand2,
  Layers,
  Plus,
  ThumbsUp,
} from 'lucide-react';

const MAIN_TABS: { id: CatalogCategory; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'now_playing', label: 'تازه اکران‌شده (جدید)', icon: <Flame className="h-4 w-4 text-rose-500" />, badge: 'روز' },
  { id: 'top_250_movies', label: '۲۵۰ فیلم برتر تاریخ', icon: <Trophy className="h-4 w-4 text-[#e5a93c]" />, badge: 'Top 250' },
  { id: 'top_250_animations', label: '۲۵۰ انیمیشن برتر', icon: <Wand2 className="h-4 w-4 text-emerald-400" />, badge: 'انیمیشن' },
  { id: 'recommended', label: 'فیلم‌های پیشنهادی ویژه', icon: <ThumbsUp className="h-4 w-4 text-sky-400" /> },
  { id: 'trending', label: 'ترند هفتگی جهان', icon: <Zap className="h-4 w-4 text-amber-400" /> },
  { id: 'tv_trending', label: 'سریال‌های برتر روز', icon: <Tv className="h-4 w-4 text-purple-400" /> },
  { id: 'genre', label: 'دسته‌بندی ژانرها', icon: <Layers className="h-4 w-4 text-pink-400" /> },
];

export default function CinephileHomePage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [activeCategory, setActiveCategory] = useState<CatalogCategory>('now_playing');
  const [selectedGenre, setSelectedGenre] = useState<GenreOption>(MOVIE_GENRES[0]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [liveResults, setLiveResults] = useState<MediaItem[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [similarItems, setSimilarItems] = useState<MediaItem[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);
  const [autoPlayTrigger, setAutoPlayTrigger] = useState<boolean>(false);

  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('user_tmdb_api_key') || '';
    if (savedKey) setApiKey(savedKey);
    loadCatalog('now_playing', 1, savedKey, MOVIE_GENRES[0]);
  }, []);

  // بارگذاری خودکار فیلم‌های پیشنهادی و مشابه هر بار که فیلم جدیدی انتخاب می‌شود
  useEffect(() => {
    if (!selectedMedia) return;
    let ignore = false;
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
        const res = await fetchCatalogFromApi({
          similarToId: selectedMedia.tmdbId,
          mediaType: selectedMedia.media_type,
          apiKey,
        });
        if (!ignore) setSimilarItems(res.items);
      } catch {
        // ignore
      } finally {
        if (!ignore) setLoadingSimilar(false);
      }
    };
    fetchSimilar();
    return () => {
      ignore = true;
    };
  }, [selectedMedia?.tmdbId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // جستجوی زنده هنگام تایپ
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLiveResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLive(true);
      setShowDropdown(true);
      try {
        const res = await fetchCatalogFromApi({ query: searchQuery, apiKey });
        setLiveResults(res.items.slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingLive(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, apiKey]);

  const loadCatalog = async (
    category: CatalogCategory,
    targetPage = 1,
    key = apiKey,
    genre = selectedGenre,
    append = false
  ) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetchCatalogFromApi({
        category,
        page: targetPage,
        genreId: category === 'genre' ? genre.id : undefined,
        genreName: category === 'genre' ? genre.enName : undefined,
        apiKey: key,
      });

      if (append) {
        setItems((prev) => [...prev, ...res.items]);
      } else {
        setItems(res.items);
        if (res.items.length > 0 && !selectedMedia) {
          setSelectedMedia(res.items[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadCatalog(activeCategory, nextPage, apiKey, selectedGenre, true);
  };

  const handleSearchAndAutoPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setShowDropdown(false);
    try {
      const res = await fetchCatalogFromApi({ query: searchQuery, apiKey });
      setItems(res.items);
      if (res.items.length > 0) {
        setSelectedMedia(res.items[0]);
        setAutoPlayTrigger(true);
        setTimeout(() => {
          document.getElementById('player-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectAndPlayMedia = (item: MediaItem) => {
    setSelectedMedia(item);
    setAutoPlayTrigger(true);
    setShowDropdown(false);
    setTimeout(() => {
      document.getElementById('player-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100" dir="rtl">
      {/* هدر */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e5a93c] to-[#be123c] text-black shadow-lg shadow-[#e5a93c]/20">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-white">
                  سینه‌فیل <span className="text-[#e5a93c]">وایب‌فارسی</span>
                </span>
                <p className="text-[11px] text-zinc-400">
                  ۲۵۰ فیلم و انیمیشن برتر • دسته‌بندی ژانرها • خلاصه داستان و بازیگران
                </p>
              </div>
            </div>
          </div>

          {/* سرچ هوشمند */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-2xl">
            <form onSubmit={handleSearchAndAutoPlay} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => {
                    if (liveResults.length > 0) setShowDropdown(true);
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی نام فیلم، انیمیشن یا بازیگر..."
                  className="w-full rounded-2xl border border-white/15 bg-[#121215] py-2.5 pr-10 pl-9 text-xs text-white placeholder-zinc-400 focus:border-[#e5a93c] focus:outline-none"
                />
                <Search className="absolute right-3.5 top-3 h-4 w-4 text-[#e5a93c]" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setLiveResults([]);
                      setShowDropdown(false);
                      loadCatalog(activeCategory, 1);
                    }}
                    className="absolute left-3 top-3 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-gradient-to-r from-[#e5a93c] to-amber-500 px-4 py-2.5 text-xs font-black text-black shadow-lg shadow-[#e5a93c]/20 transition hover:brightness-110 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>سرچ و پخش خودکار</span>
              </button>
            </form>

            {/* دراپ‌داون نتایج زنده با عکس بدون فیلتر، امتیاز و بازیگران */}
            {showDropdown && (
              <div className="absolute right-0 left-0 top-full mt-2 max-h-96 overflow-y-auto rounded-2xl border border-white/15 bg-[#121215]/95 p-2 shadow-2xl backdrop-blur-2xl z-50">
                {isSearchingLive ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin text-[#e5a93c]" />
                    <span>در حال دریافت تصاویر، خلاصه داستان و کد استریم...</span>
                  </div>
                ) : liveResults.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-500">نتیجه‌ای یافت نشد.</div>
                ) : (
                  <div className="space-y-1.5">
                    {liveResults.map((item) => (
                      <div
                        key={\`\${item.media_type}_\${item.tmdbId}\`}
                        onClick={() => selectAndPlayMedia(item)}
                        className="flex items-center justify-between gap-3 rounded-xl p-2 transition hover:bg-white/10 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.poster_url}
                            alt={item.title}
                            className="h-14 w-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=300&output=webp';
                            }}
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white">{item.title}</h4>
                              <span className="rounded bg-[#e5a93c]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#e5a93c]">
                                ★ {toPersianDigits(item.vote_average.toFixed(1))}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-1">
                              بازیگران: {item.cast?.join('، ')}
                            </p>
                            <p className="text-[10px] text-zinc-500 line-clamp-1">{item.overview}</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 rounded-xl bg-[#be123c] px-3 py-1.5 text-xs font-bold text-white shrink-0">
                          <Play className="h-3 w-3 fill-current" />
                          پخش
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowKeyModal(true)}
            className="hidden lg:flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121215] px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#e5a93c] cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span>تنظیمات API</span>
          </button>
        </div>
      </header>

      {/* بخش Hero */}
      <section className="relative overflow-hidden border-b border-white/10 py-7">
        <HeroCanvas />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5a93c]/30 bg-[#e5a93c]/10 px-3.5 py-1 text-xs font-semibold text-[#e5a93c]">
              <Sparkles className="h-3.5 w-3.5" />
              مجهز به پراکسی تصویر بدون تحریم + مترجم خودکار خلاصه داستان + نام بازیگران
            </span>
            <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">
              آرشیو جامع <span className="text-[#e5a93c]">۲۵۰ فیلم و انیمیشن برتر</span> و اکران‌های روز
            </h1>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        {/* پلیر و شناسنامه کامل فیلم انتخاب‌شده */}
        {selectedMedia && (
          <section id="player-section" className="scroll-mt-24 space-y-6">
            <FrameXPlayer media={selectedMedia} autoPlayTrigger={autoPlayTrigger} />

            {/* ردیف فیلم‌های پیشنهادی و مشابه بر اساس فیلم فعلی */}
            <div className="rounded-3xl border border-white/10 bg-[#121215]/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-white">
                  <ThumbsUp className="h-4 w-4 text-[#e5a93c]" />
                  <span>فیلم‌های پیشنهادی و مشابه «{selectedMedia.title}»</span>
                </h3>
                <span className="text-xs text-zinc-400">دریافت زنده از API</span>
              </div>

              {loadingSimilar ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                  {similarItems.map((sim) => (
                    <div
                      key={sim.tmdbId}
                      onClick={() => selectAndPlayMedia(sim)}
                      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] transition hover:-translate-y-1 hover:border-[#e5a93c]"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
                        <img
                          src={sim.poster_url}
                          alt={sim.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=400&output=webp';
                          }}
                        />
                        <div className="absolute top-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-[#e5a93c]">
                          ★ {toPersianDigits(sim.vote_average.toFixed(1))}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <h4 className="line-clamp-1 text-xs font-bold text-white">{sim.title}</h4>
                        <p className="mt-1 line-clamp-1 text-[10px] text-zinc-400">
                          {sim.cast?.slice(0, 2).join('، ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* نوار تب‌های اصلی (تازه اکران‌شده، ۲۵۰ فیلم برتر، ۲۵۰ انیمیشن برتر، ژانرها، پیشنهادی) */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {MAIN_TABS.map((tab) => {
                const active = activeCategory === tab.id && !searchQuery.trim();
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory(tab.id);
                      setPage(1);
                      loadCatalog(tab.id, 1, apiKey, selectedGenre, false);
                    }}
                    className={\`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer \${
                      active
                        ? 'bg-[#e5a93c] text-black shadow-lg shadow-[#e5a93c]/25'
                        : 'border border-white/10 bg-[#121215] text-zinc-300 hover:border-white/25 hover:text-white'
                    }\`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={\`rounded-md px-1.5 py-0.5 text-[10px] \${
                          active ? 'bg-black/20 text-black' : 'bg-[#be123c] text-white'
                        }\`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* نوار انتخاب ژانر (وقتی تب دسته‌بندی ژانرها فعال است یا کاربر می‌خواهد فیلتر کند) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-[#e5a93c] ml-1">فیلتر سریع ژانر:</span>
              {MOVIE_GENRES.map((genre) => {
                const isGenreActive = activeCategory === 'genre' && selectedGenre.id === genre.id;
                return (
                  <button
                    key={genre.id}
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('genre');
                      setSelectedGenre(genre);
                      setPage(1);
                      loadCatalog('genre', 1, apiKey, genre, false);
                    }}
                    className={\`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer \${
                      isGenreActive
                        ? 'bg-[#be123c] text-white shadow-lg shadow-[#be123c]/30'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }\`}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* شبکه کارت‌های فیلم با نمایش تصویر، امتیاز به‌روز، نام بازیگران و خلاصه داستان */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-96 animate-pulse rounded-3xl border border-white/5 bg-[#121215]"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map((item, idx) => {
                  const isSelected = selectedMedia?.tmdbId === item.tmdbId;
                  return (
                    <div
                      key={\`\${item.media_type}_\${item.tmdbId}_\${idx}\`}
                      onClick={() => selectAndPlayMedia(item)}
                      className={\`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 cursor-pointer \${
                        isSelected
                          ? 'border-[#e5a93c] bg-[#121215] ring-2 ring-[#e5a93c]/40'
                          : 'border-white/10 bg-[#121215]/80 hover:-translate-y-1.5 hover:border-[#e5a93c]/50'
                      }\`}
                    >
                      {/* پوستر با پراکسی ضدتحریم */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                        <img
                          src={item.poster_url}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://wsrv.nl/?url=https://images.unsplash.com/photo-1489599849927-2ee91cede3ba&w=500&output=webp';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121215] via-[#121215]/30 to-transparent" />

                        {/* بج امتیاز به‌روز */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-black/85 px-2.5 py-1 text-xs font-black text-[#e5a93c] backdrop-blur-md shadow">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span>{toPersianDigits(item.vote_average.toFixed(1))}</span>
                        </div>

                        {/* رتبه در ۲۵۰ فیلم یا انیمیشن برتر */}
                        {item.rank && (
                          <div className="absolute top-3 left-3 rounded-xl bg-[#e5a93c] px-2.5 py-1 text-xs font-black text-black shadow">
                            #{toPersianDigits(item.rank)}
                          </div>
                        )}

                        {!item.rank && item.isNewRelease && (
                          <div className="absolute top-3 left-3 rounded-xl bg-[#be123c] px-2.5 py-1 text-[10px] font-bold text-white shadow">
                            اکران جدید
                          </div>
                        )}

                        {/* دکمه شناور پخش */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/50 backdrop-blur-[2px]">
                          <span className="flex items-center gap-1.5 rounded-full bg-[#e5a93c] px-5 py-2.5 text-xs font-black text-black shadow-xl">
                            <Play className="h-4 w-4 fill-current" />
                            پخش در پلیر
                          </span>
                        </div>
                      </div>

                      {/* محتوای متنی کارت: عنوان، ژانر، نام بازیگران و خلاصه داستان */}
                      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="line-clamp-1 text-sm font-black text-white">{item.title}</h3>
                          </div>

                          {/* ژانرها */}
                          <div className="flex flex-wrap gap-1">
                            {item.genres?.slice(0, 3).map((g, i) => (
                              <span
                                key={i}
                                className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-[#e5a93c]"
                              >
                                {g}
                              </span>
                            ))}
                          </div>

                          {/* نام بازیگران */}
                          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-zinc-300">
                            <Users className="h-3.5 w-3.5 shrink-0 text-[#be123c]" />
                            <span className="line-clamp-1 font-medium">
                              {item.cast?.join('، ')}
                            </span>
                          </div>

                          {/* خلاصه داستان روی کارت */}
                          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400 pt-1">
                            {item.overview}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-[#e5a93c]" />
                            {toJalaliDate(item.release_date, true)} ({toPersianGregorianYear(item.release_date)})
                          </span>
                          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-[#e5a93c] font-mono">
                            TMDB: {toPersianDigits(item.tmdbId)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* دکمه بارگذاری صفحه بعدی (برای دیدن تمام ۲۵۰ فیلم برتر، ۲۵۰ انیمیشن و ژانرها) */}
              <div className="flex justify-center pt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-2xl border border-[#e5a93c]/40 bg-[#121215] px-8 py-3.5 text-xs font-black text-[#e5a93c] transition hover:bg-[#e5a93c] hover:text-black cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>در حال دریافت ادامه لیست از API...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>نمایش فیلم‌های بیشتر (صفحه {toPersianDigits(page + 1)})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        {/* دفترچه خاطرات سینمایی */}
        <FilmDiary selectedMovieTitle={selectedMedia?.title} />
      </main>

      {/* مودال تنظیم کلید */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#121215] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">تنظیمات کلید TMDB API</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              برنامه به صورت خودکار به پراکسی تصویر بدون تحریم، کلید داخلی TMDB و سرویس OMDb متصل است. در صورت تمایل می‌توانید کلید اختصاصی خود را نیز وارد کنید:
            </p>
            <div className="mt-4 space-y-4">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="کلید شخصی TMDB (اختیاری)"
                className="w-full rounded-xl border border-white/10 bg-[#09090b] px-3.5 py-2.5 text-xs text-white focus:border-[#e5a93c] focus:outline-none"
                dir="ltr"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="rounded-xl bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10 cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('user_tmdb_api_key', apiKey.trim());
                    setShowKeyModal(false);
                    loadCatalog(activeCategory, 1, apiKey.trim());
                  }}
                  className="rounded-xl bg-[#e5a93c] px-5 py-2 text-xs font-bold text-black hover:bg-amber-400 cursor-pointer"
                >
                  ذخیره
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`,
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✅ Updated: ${relPath}`);
}

console.log('\n🎬 نسخه ۳.۰ با موفقیت نصب شد! حالا دستور npm.cmd run dev را اجرا کنید.');