import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const storageUrl = process.env.STORAGE_URL;

  if (storageUrl) {
    // To avoid leaking the full secret, we'll only show part of it.
    const urlPreview = `${storageUrl.substring(0, 25)}...`;
    
    return response.status(200).json({ 
        status: 'موفق', 
        message: 'متغیر محیطی STORAGE_URL با موفقیت خوانده شد.',
        urlPreview: urlPreview 
    });
  } else {
    return response.status(500).json({ 
        status: 'خطا',
        error: 'متغیر اتصال به پایگاه داده (STORAGE_URL) در سرور یافت نشد.', 
        details: 'به نظر می‌رسد اتصال بین پروژه Vercel و پایگاه داده به درستی انجام نشده است. لطفاً از اتصال صحیح در تنظیمات Storage اطمینان حاصل کرده و پروژه را مجدداً Redeploy کنید.' 
    });
  }
}
