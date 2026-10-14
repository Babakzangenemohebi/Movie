'use client';

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
                        key={`${item.media_type}_${item.tmdbId}`}
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
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#e5a93c] text-black shadow-lg shadow-[#e5a93c]/25'
                        : 'border border-white/10 bg-[#121215] text-zinc-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          active ? 'bg-black/20 text-black' : 'bg-[#be123c] text-white'
                        }`}
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
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      isGenreActive
                        ? 'bg-[#be123c] text-white shadow-lg shadow-[#be123c]/30'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
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
                      key={`${item.media_type}_${item.tmdbId}_${idx}`}
                      onClick={() => selectAndPlayMedia(item)}
                      className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 cursor-pointer ${
                        isSelected
                          ? 'border-[#e5a93c] bg-[#121215] ring-2 ring-[#e5a93c]/40'
                          : 'border-white/10 bg-[#121215]/80 hover:-translate-y-1.5 hover:border-[#e5a93c]/50'
                      }`}
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
