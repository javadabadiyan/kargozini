import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import handler, { setupTables } from './backend/users/index.js';

const app: Express = express();
const port = process.env.PORT || 10000;

// Enable CORS
app.use(cors());

// Body parsers with a generous body size limit.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API route: All requests to /api/users will be handled by our consolidated handler.
const apiUserHandler = (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
};
app.use('/api/users', apiUserHandler);

// Initialize database and then start server
async function startServer() {
  try {
    console.log("Initializing database tables...");
    await setupTables();
    console.log("Database tables initialized successfully.");

    // Only run the server locally. Vercel will handle this in production.
    if (!process.env.VERCEL) {
      app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
      });
    }
  } catch (error) {
    console.error("Failed to start server due to database initialization error:", error);
  }
}

startServer();

// Export the app for Vercel's runtime.
export default app;