import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Role } from '../../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // GET: Fetch all roles
  if (req.method === 'GET') {
    try {
      // Ensure the 'roles' table exists.
      await sql`
        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL
        );
      `;
    
      // Add some default roles if they don't exist to ensure the app has initial data.
      await sql`
          INSERT INTO roles (name) VALUES ('مدیر'), ('کاربر') ON CONFLICT (name) DO NOTHING;
      `;

      const { rows } = await sql<Role>`SELECT * FROM roles ORDER BY name;`;
      return res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to fetch roles', details: errorMessage });
    }
  }

  // POST: Create a new role
  if (req.method === 'POST') {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
      }
      
      const result = await sql<Role>`
        INSERT INTO roles (name) 
        VALUES (${name})
        RETURNING *;
      `;
      return res.status(201).json(result.rows[0]);

    } catch (error) {
      console.error(error);
      // Handle unique constraint violation
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        return res.status(409).json({ error: 'Role with this name already exists', details: error.message });
      }
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to create role', details: errorMessage });
    }
  }

  // DELETE: Delete a role
  if (req.method === 'DELETE') {
    try {
      const id = Number(req.query.id);
      if (!id) return res.status(400).json({ error: 'Role ID is required' });
      
      // Note: In a real-world app, you might want to prevent deleting a role that's in use.
      // For simplicity, we are allowing it here.
      await sql`DELETE FROM roles WHERE id = ${id};`;
      return res.status(204).send(null); // No Content

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Failed to delete role', details: errorMessage });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
