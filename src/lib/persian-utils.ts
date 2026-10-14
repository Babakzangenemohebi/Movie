// تبدیل تمام اعداد انگلیسی به فارسی
export function toPersianDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, (digit) => persianDigits[parseInt(digit, 10)]);
}

// تبدیل تاریخ میلادی به شمسی (فرمت کامل یا فقط سال)
export function toJalaliDate(dateString?: string, onlyYear = false): string {
  if (!dateString) return 'نامشخص';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return toPersianDigits(dateString);

  if (onlyYear) {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(date);
  }

  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

// دریافت سال میلادی به صورت اعداد فارسی
export function toPersianGregorianYear(dateString?: string): string {
  if (!dateString) return '';
  const year = dateString.split('-')[0];
  return toPersianDigits(year);
}

// ماه‌های تقویم شمسی وایب‌فارسی
export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
