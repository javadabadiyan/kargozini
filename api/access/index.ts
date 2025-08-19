import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // This endpoint is obsolete. Permissions are now managed directly on users
  // via the /api/app-users endpoint.
  if (req.method === 'GET') {
    return res.status(200).json({ permissions: [] });
  }
  if (req.method === 'POST') {
    return res.status(200).json({ message: 'Permissions are now managed per-user.' });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
