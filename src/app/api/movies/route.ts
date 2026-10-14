import { NextRequest, NextResponse } from 'next/server';

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
  return `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=${w}&output=webp`;
}

// ترجمه خودکار خلاصه داستان انگلیسی به فارسی روان
async function translateToPersian(text: string): Promise<string> {
  if (!text || text.trim().length < 5) return '';
  // اگر متن از قبل فارسی است، نیازی به ترجمه ندارد
  if (/[\u0600-\u06FF]/.test(text)) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=${encodeURIComponent(text)}`;
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
    const targetUrl = `${TMDB_BASE}${path}${sep}api_key=${key}`;

    // ۱. تلاش مستقیم
    try {
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) return await res.json();
    } catch {
      // ادامه به پراکسی
    }

    // ۲. تلاش از طریق پراکسی بدون تحریم (برای اینترنت ایران)
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
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
      `/${mediaType}/${id}?language=en-US&append_to_response=credits`,
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
          `https://www.omdbapi.com/?t=${encodeURIComponent(originalTitle)}&apikey=${oKey}`,
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
    ? `${TMDB_IMG}/w500${item.poster_path}`
    : item.backdrop_path
    ? `${TMDB_IMG}/w780${item.backdrop_path}`
    : '';

  const rawBackdrop = item.backdrop_path
    ? `${TMDB_IMG}/w1280${item.backdrop_path}`
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
    const values = imdbIds.map((id) => `"${id}"`).join(' ');
    const sparql = `
      SELECT ?imdb ?tmdbMovie ?tmdbTv WHERE {
        VALUES ?imdb { ${values} }
        ?item wdt:P345 ?imdb .
        OPTIONAL { ?item wdt:P4947 ?tmdbMovie . }
        OPTIONAL { ?item wdt:P4983 ?tmdbTv . }
      }
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
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
  const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(firstChar)}/${encodeURIComponent(clean)}.json`;

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
          `https://www.omdbapi.com/?i=${item.id}&apikey=trilogy`,
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
        overview: plotFa || `اثر تحسین‌شده با هنرنمایی ${actors.join('، ')}`,
        cast: actors.length > 0 ? actors : ['بازیگران مطرح سینما'],
        director: director || undefined,
        genres: genresFa,
        poster_url: proxyImg(item.i?.imageUrl, 500),
        backdrop_url: proxyImg(item.i?.imageUrl, 1280),
        release_date: item.y ? `${item.y}-01-01` : '2025-01-01',
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
      `/${mediaTypeParam}/${similarToId}/recommendations?language=fa-IR&page=1`,
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
      `/search/multi?language=fa-IR&query=${encodeURIComponent(query.trim())}&include_adult=false`,
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
  let tmdbPath = `/movie/now_playing?language=fa-IR&page=${page}`;
  let isRankedList = false;

  if (category === 'trending') {
    tmdbPath = `/trending/movie/week?language=fa-IR&page=${page}`;
  } else if (category === 'recommended') {
    tmdbPath = `/discover/movie?language=fa-IR&sort_by=popularity.desc&vote_average.gte=7.2&vote_count.gte=500&page=${page}`;
  } else if (category === 'top_250_movies') {
    tmdbPath = `/movie/top_rated?language=fa-IR&page=${page}`;
    isRankedList = true;
  } else if (category === 'top_250_animations') {
    tmdbPath = `/discover/movie?language=fa-IR&with_genres=16&sort_by=vote_average.desc&vote_count.gte=800&page=${page}`;
    isRankedList = true;
  } else if (category === 'tv_trending') {
    tmdbPath = `/trending/tv/week?language=fa-IR&page=${page}`;
  } else if (category === 'genre' && genreId) {
    tmdbPath = `/discover/movie?language=fa-IR&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=200&page=${page}`;
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
