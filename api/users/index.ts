import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // GET: Fetch all users
  if (req.method === 'GET') {
    try {
      const { rows } = await sql<User>`SELECT id, "firstName", "lastName", username, role FROM users ORDER BY id DESC;`;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch users', details: errorMessage });
    }
  }

  // POST: Create or Update a user
  if (req.method === 'POST') {
    try {
      const { id, firstName, lastName, username, role } = req.body;

      if (id) { // Update
        await sql`
          UPDATE users 
          SET "firstName" = ${firstName}, "lastName" = ${lastName}, username = ${username}, role = ${role} 
          WHERE id = ${id};
        `;
        const { rows } = await sql<User>`SELECT * FROM users WHERE id = ${id};`;
        return res.status(200).json(rows[0]);
      } else { // Create
        const result = await sql`
          INSERT INTO users ("firstName", "lastName", username, role) 
          VALUES (${firstName}, ${lastName}, ${username}, ${role})
          RETURNING *;
        `;
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to save user', details: errorMessage });
    }
  }

  // DELETE: Delete a user
  if (req.method === 'DELETE') {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'User ID is required' });
      
      await sql`DELETE FROM users WHERE id = ${id};`;
      return res.status(204).send(null); // No Content
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to delete user', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}