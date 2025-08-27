import express, { Request, Response } from 'express';
import cors from 'cors';
import { URL as NodeURL } from 'url';
import { fetchOG } from './fetch-og';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'Cloud Browser API',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/og/*', async (req: Request, res: Response): Promise<void> => {
    const raw = req.params[0];

    if (!raw) {
        res.status(400).json({
            error: 'URL parameter is required'
        });
        return;
    }

    let decodedUrl: string;

    try {
        decodedUrl = decodeURIComponent(raw);
        new NodeURL(decodedUrl);
    } catch {
        res.status(400).json({
            error: 'Invalid URL'
        });
        return;
    }

    const og = await fetchOG(decodedUrl)

    if (!og) {
        res.status(500).json({success: false});
        return
    }

    res.send({og, success: true})
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
});
