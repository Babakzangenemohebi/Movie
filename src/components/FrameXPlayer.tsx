'use client';

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

  const storageKey = `cinephile_progress_${mediaType}_${customTmdbId}_${season}_${episode}`;

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
        ? `https://framextv.xyz/embed/${customTmdbId}`
        : `https://framextv.xyz/embed/${customTmdbId}/${season}/${episode}`;

    const params = new URLSearchParams({
      autoplay: autoPlayTrigger ? '1' : '0',
      muted: '0',
      controls: '1',
      server: selectedServer,
      title: media.title,
      poster: media.backdrop_url,
      t: savedTimestamp.toString(),
    });

    return `${basePath}?${params.toString()}`;
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
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#e5a93c] text-[#09090b] shadow-lg shadow-[#e5a93c]/25'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{srv.label}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        active ? 'bg-black/20 text-black' : 'bg-[#be123c]/30 text-rose-300'
                      }`}
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                mediaType === 'movie' ? 'bg-[#be123c] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              فیلم سینمایی
            </button>
            <button
              onClick={() => setMediaType('tv')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                mediaType === 'tv' ? 'bg-[#be123c] text-white' : 'text-zinc-400 hover:text-white'
              }`}
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
