import express from 'express';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import handler, { setupTables } from './api/users/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 10000;

// Enable CORS
app.use(cors());

// Body parsers with a generous body size limit.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API route: All requests to /api/users will be handled by our consolidated handler.
const apiUserHandler = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    handler(req, res).catch(next);
};
app.use('/api/users', apiUserHandler);

// Serve static files from the React app build directory
// __dirname will be 'build/' after compilation. The client is in 'dist/'.
const clientBuildPath = path.join(__dirname, '../dist');
app.use(express.static(clientBuildPath));

// The "catchall" handler: for any request that doesn't match one above,
// send back React's index.html file to enable client-side routing.
const catchallHandler = (req: ExpressRequest, res: ExpressResponse) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
};
app.get('*', catchallHandler);

// Initialize database and then start server
async function startServer() {
  try {
    console.log("Initializing database tables...");
    await setupTables();
    console.log("Database tables initialized successfully.");

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server due to database initialization error:", error);
    // process.exit(1) is not ideal for serverless environments.
  }
}

startServer();

// Export the app for Vercel's runtime.
export default app;