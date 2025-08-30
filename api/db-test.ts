// No imports to remove any potential module resolution errors.
// This is a plain Node.js serverless function.
export default function handler(req: any, res: any) {
  try {
    const storageUrl = process.env.STORAGE_URL;

    if (storageUrl) {
      const urlPreview = `${storageUrl.substring(0, 25)}...`;
      res.status(200).json({ 
          status: 'موفق', 
          message: 'متغیر محیطی STORAGE_URL با موفقیت خوانده شد.',
          urlPreview: urlPreview 
      });
    } else {
      res.status(500).json({ 
          status: 'خطا',
          error: 'متغیر اتصال به پایگاه داده (STORAGE_URL) در سرور یافت نشد.', 
          details: 'این یک خطای قطعی در تنظیمات پروژه Vercel است. متغیرهای محیطی به درستی به برنامه تزریق نمی‌شوند. لطفاً پروژه را در Vercel حذف و دوباره ایجاد کنید.'
      });
    }
  } catch (error) {
    // Add a catch-all to see if any error happens even inside this simple logic.
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({
      status: 'خطای فاجعه‌بار',
      error: 'یک خطا در خود تابع تست رخ داد.',
      details: errorMessage
    });
  }
}
