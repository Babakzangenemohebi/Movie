import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: 'سینه‌فیل | استریم خودکار فیلم‌های روز و تحلیل سینمایی',
  description: 'جستجوی خودکار کد TMDB، نمایش فیلم‌های تازه اکران‌شده، استریم مستقیم FrameXTV و دفترچه خاطرات شمسی',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body
        className={`${vazirmatn.className} min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-[#e5a93c] selection:text-black`}
      >
        {children}
      </body>
    </html>
  );
}
