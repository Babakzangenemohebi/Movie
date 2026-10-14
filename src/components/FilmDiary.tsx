'use client';

import React, { useState, useEffect } from 'react';
import { toPersianDigits, JALALI_MONTHS } from '@/lib/persian-utils';
import { Calendar, Star, Trash2, BookOpen, PlusCircle } from 'lucide-react';

export interface DiaryEntry {
  id: string;
  movieTitle: string;
  jalaliDate: string;
  rating: number;
  review: string;
  rewatch: boolean;
}

export default function FilmDiary({ selectedMovieTitle }: { selectedMovieTitle?: string }) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [movieTitle, setMovieTitle] = useState(selectedMovieTitle || '');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [rewatch, setRewatch] = useState(false);

  // تقویم شمسی وایب‌فارسی
  const [jYear, setJYear] = useState(1405);
  const [jMonth, setJMonth] = useState('مهر');
  const [jDay, setJDay] = useState(22);

  useEffect(() => {
    if (selectedMovieTitle) setMovieTitle(selectedMovieTitle);
  }, [selectedMovieTitle]);

  useEffect(() => {
    const raw = localStorage.getItem('cinephile_diary_v2');
    if (raw) {
      try {
        setEntries(JSON.parse(raw));
      } catch {
        setEntries([]);
      }
    }
  }, []);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieTitle.trim()) return;

    const formattedJalali = `${toPersianDigits(jDay)} ${jMonth} ${toPersianDigits(jYear)}`;

    const newEntry: DiaryEntry = {
      id: crypto.randomUUID(),
      movieTitle,
      jalaliDate: formattedJalali,
      rating,
      review,
      rewatch,
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    localStorage.setItem('cinephile_diary_v2', JSON.stringify(updated));
    setReview('');
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter((item) => item.id !== id);
    setEntries(updated);
    localStorage.setItem('cinephile_diary_v2', JSON.stringify(updated));
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#121215]/90 p-6 shadow-2xl backdrop-blur-xl" dir="rtl">
      <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5a93c]/15 text-[#e5a93c]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">دفترچه خاطرات سینمایی (Film Diary)</h2>
            <p className="text-xs text-zinc-400">ثبت تاریخ تماشا با تقویم شمسی وایب‌فارسی و یادداشت‌های تحلیلی به سبک Letterboxd</p>
          </div>
        </div>
        <span className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-[#e5a93c] font-semibold">
          {toPersianDigits(entries.length)} فیلم ثبت‌شده
        </span>
      </div>

      <form onSubmit={handleAddEntry} className="mb-8 space-y-4 rounded-2xl border border-white/5 bg-[#09090b]/60 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">نام فیلم یا سریال</label>
            <input
              type="text"
              value={movieTitle}
              onChange={(e) => setMovieTitle(e.target.value)}
              placeholder="مثلاً: جدایی نادر از سیمین..."
              className="w-full rounded-xl border border-white/10 bg-[#121215] px-3.5 py-2.5 text-sm text-white focus:border-[#e5a93c] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs text-zinc-400">
              <Calendar className="h-3.5 w-3.5 text-[#e5a93c]" />
              تاریخ تماشا (تقویم شمسی)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={jDay}
                onChange={(e) => setJDay(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-[#121215] px-2 py-2.5 text-xs text-white focus:border-[#e5a93c] focus:outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {toPersianDigits(d)}
                  </option>
                ))}
              </select>

              <select
                value={jMonth}
                onChange={(e) => setJMonth(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#121215] px-2 py-2.5 text-xs text-white focus:border-[#e5a93c] focus:outline-none"
              >
                {JALALI_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={jYear}
                onChange={(e) => setJYear(Number(e.target.value))}
                className="rounded-xl border border-white/10 bg-[#121215] px-2 py-2.5 text-xs text-white focus:border-[#e5a93c] focus:outline-none"
              >
                {[1405, 1404, 1403, 1402, 1401, 1400].map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs text-zinc-400">
              <Star className="h-3.5 w-3.5 text-[#e5a93c]" />
              امتیاز شما (از ۵ ستاره)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#121215] px-3 py-2.5 text-xs text-[#e5a93c] font-bold focus:border-[#e5a93c] focus:outline-none"
              >
                {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((r) => (
                  <option key={r} value={r}>
                    {toPersianDigits(r)} از ۵ ★
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-[#121215] px-3 py-2.5 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rewatch}
                  onChange={(e) => setRewatch(e.target.checked)}
                  className="accent-[#be123c]"
                />
                تماشای مجدد
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="نقد کوتاه، تحلیل فرم یا حس شما پس از تماشای فیلم..."
            className="flex-1 rounded-xl border border-white/10 bg-[#121215] px-4 py-2.5 text-sm text-white focus:border-[#e5a93c] focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#be123c] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#be123c]/25 transition hover:bg-rose-700 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            ثبت در دفترچه خاطرات
          </button>
        </div>
      </form>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          هنوز فیلمی در دفترچه خاطرات شما ثبت نشده است. اولین تحلیل سینمایی خود را بالا بنویسید!
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-[#09090b]/80 p-4 transition hover:border-white/15 md:flex-row md:items-center"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white">{item.movieTitle}</h4>
                  {item.rewatch && (
                    <span className="rounded-md bg-[#be123c]/20 px-2 py-0.5 text-[10px] text-rose-300">
                      تماشای مجدد
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {item.review || 'بدون یادداشت تحلیلی'}
                </p>
              </div>
              <div className="flex items-center gap-3 self-end md:self-center">
                <span className="rounded-xl bg-[#e5a93c]/15 px-3 py-1 text-xs font-bold text-[#e5a93c]">
                  {toPersianDigits(item.rating)} ★
                </span>
                <span className="rounded-xl bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  {item.jalaliDate}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
