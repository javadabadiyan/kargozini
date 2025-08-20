import express from 'express';
import type { Request, Response } from 'express';
import handler from './users/index';

const app = express();
// Render's default port is 10000. It's good practice to use process.env.PORT.
const port = process.env.PORT || 10000;

// Set a generous body size limit, similar to Vercel's default.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route all API requests to the consolidated handler.
// The '/api/*' part is handled by the platform's routing or proxy;
// here, we catch all routes and pass them to the handler.
app.all('/*', (req: Request, res: Response) => {
    // The handler is async, so we wrap it to catch any unhandled promise rejections.
    Promise.resolve(handler(req, res)).catch(error => {
        console.error("Unhandled error from API handler:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});