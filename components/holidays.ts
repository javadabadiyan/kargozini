
export interface Holiday {
  date: [number, number, number]; // [year, month, day]
  description: string;
  isHoliday: boolean;
}

export const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// Official holidays for Persian Year 1403
export const holidays1403: Holiday[] = [
  { date: [1403, 1, 1], description: 'جشن نوروز/جشن سال نو', isHoliday: true },
  { date: [1403, 1, 2], description: 'عیدنوروز', isHoliday: true },
  { date: [1403, 1, 3], description: 'عید نوروز', isHoliday: true },
  { date: [1403, 1, 4], description: 'عید نوروز', isHoliday: true },
  { date: [1403, 1, 12], description: 'روز جمهوری اسلامی ایران', isHoliday: true },
  { date: [1403, 1, 13], description: 'روز طبیعت', isHoliday: true },
  { date: [1403, 1, 22], description: 'عید سعید فطر', isHoliday: true },
  { date: [1403, 1, 23], description: 'تعطیل به مناسبت عید سعید فطر', isHoliday: true },
  { date: [1403, 1, 25], description: 'شهادت امام جعفر صادق (ع)', isHoliday: true },
  { date: [1403, 3, 14], description: 'رحلت حضرت امام خمینی', isHoliday: true },
  { date: [1403, 3, 15], description: 'قیام خونین 15 خرداد', isHoliday: true },
  { date: [1403, 4, 5], description: 'عید سعید غدیر خم', isHoliday: true },
  { date: [1403, 4, 25], description: 'تاسوعای حسینی', isHoliday: true },
  { date: [1403, 4, 26], description: 'عاشورای حسینی', isHoliday: true },
  { date: [1403, 6, 4], description: 'اربعین حسینی', isHoliday: true },
  { date: [1403, 6, 12], description: 'رحلت رسول اکرم و شهادت امام حسن مجتبی (ع)', isHoliday: true },
  { date: [1403, 6, 14], description: 'شهادت امام رضا (ع)', isHoliday: true },
  { date: [1403, 6, 22], description: 'شهادت امام حسن عسکری و آغاز امامت حضرت ولیعصر (عج)', isHoliday: true },
  { date: [1403, 7, 1], description: 'ولادت رسول اکرم و امام جعفر صادق (ع)', isHoliday: true },
  { date: [1403, 11, 3], description: 'ولادت امام علی (ع)', isHoliday: true },
  { date: [1403, 11, 17], description: 'مبعث رسول اکرم (ص)', isHoliday: true },
  { date: [1403, 11, 22], description: 'پیروزی انقلاب اسلامی ایران', isHoliday: true },
  { date: [1403, 12, 5], description: 'ولادت حضرت قائم (عج)', isHoliday: true },
  { date: [1403, 12, 29], description: 'روز ملی شدن صنعت نفت ایران', isHoliday: true },
];
