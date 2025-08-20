import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import handler from './api/users/index';

const app = express();
const port = process.env.PORT || 10000;

// Enable CORS
app.use(cors());

// Body parsers with a generous body size limit.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API route: All requests to /api/users will be handled by our consolidated handler.
app.use('/api/users', (req: Request, res: Response) => {
    Promise.resolve(handler(req, res)).catch(error => {
        console.error("Unhandled error from API handler:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
});

// Serve static files from the React app build directory
// __dirname will be 'build/' after compilation. The client is in 'dist/'.
const clientBuildPath = path.join(__dirname, '../dist');
app.use(express.static(clientBuildPath));

// The "catchall" handler: for any request that doesn't match one above,
// send back React's index.html file to enable client-side routing.
app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});