import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission_name)
  );
`;

const ALL_PERMISSIONS = [
    { name: 'manage_personnel', description: 'افزودن، ویرایش و حذف پرسنل' },
    { name: 'view_personnel', description: 'مشاهده لیست پرسنل' },
    { name: 'manage_roles', description: 'ایجاد و حذف نقش‌ها' },
    { name: 'manage_access_control', description: 'تخصیص دسترسی به نقش‌ها' },
    { name: 'manage_settings', description: 'تغییر تنظیمات کلی برنامه' },
    { name: 'perform_backup', description: 'ایجاد و بازگردانی پشتیبان' },
];


export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
    try {
        await sql.query(createTableQuery);
    } catch (error) {
        console.error("Database setup error in /api/access:", error);
        return res.status(500).json({ error: 'Failed to initialize access control table' });
    }

  // GET: Fetch permissions for a role, or all available permissions
  if (req.method === 'GET') {
    const roleId = req.query.roleId ? Number(req.query.roleId) : null;
    
    if (req.query.type === 'all_permissions') {
        return res.status(200).json(ALL_PERMISSIONS);
    }

    if (roleId) {
        try {
            const { rows } = await sql`SELECT permission_name FROM role_permissions WHERE role_id = ${roleId};`;
            const permissions = rows.map(r => r.permission_name);
            return res.status(200).json({ permissions });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch role permissions' });
        }
    }
    
    return res.status(400).json({ error: 'Role ID or query type is required' });
  }

  // POST: Update permissions for a role
  if (req.method === 'POST') {
    const { roleId, permissions } = req.body;

    if (!roleId || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const client = await sql.connect();
    try {
        await client.query('BEGIN');
        // Delete old permissions
        await client.query('DELETE FROM role_permissions WHERE role_id = $1;', [roleId]);
        // Insert new permissions
        for (const permissionName of permissions) {
            await client.query('INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2);', [roleId, permissionName]);
        }
        await client.query('COMMIT');
        return res.status(200).json({ message: 'Permissions updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ error: 'Failed to update permissions' });
    } finally {
        client.release();
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
