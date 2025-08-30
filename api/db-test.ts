// No imports to remove any potential module resolution errors.
// This is a plain Node.js serverless function.
export default function handler(req: any, res: any) {
  try {
    const postgresUrl = process.env.POSTGRES_URL;

    if (postgresUrl) {
      const urlPreview = `${postgresUrl.substring(0, 25)}...`;
      res.status(200).json({ 
          status: 'موفق', 
          message: 'متغیر محیطی POSTGRES_URL با موفقیت خوانده شد.',
          urlPreview: urlPreview 
      });
    } else {
      res.status(500).json({ 
          status: 'خطا',
          error: 'متغیر اتصال به پایگاه داده (POSTGRES_URL) در سرور یافت نشد.', 
          details: 'متغیر POSTGRES_URL در تنظیمات پروژه Vercel یافت نشد. لطفاً از اتصال صحیح پایگاه داده Vercel Postgres به پروژه اطمینان حاصل کنید.'
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