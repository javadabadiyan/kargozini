import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // This endpoint is obsolete due to the move to a user-based permission system.
  // It returns empty/success responses to prevent breaking any old references.
  if (req.method === 'GET') {
    return res.status(200).json([]);
  }
  if (req.method === 'POST') {
    return res.status(201).json({ message: "Roles are deprecated."});
  }
  if (req.method === 'DELETE') {
    return res.status(204).send(null);
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
