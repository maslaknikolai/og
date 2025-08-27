import express, { Request, Response } from 'express';
import cors from 'cors';
import { URL as NodeURL } from 'url';
import * as cheerio from 'cheerio';
import { getBrowser } from './get-browser';
import { resolveUrl } from './resolve-url';

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

app.get('/api/og/:url(*)', async (req: Request, res: Response): Promise<void> => {
    const raw = req.params.url;
    if (!raw) {
        res.status(400).json({ error: 'URL parameter is required' });
        return;
    }

    let decodedUrl: string;

    try {
        decodedUrl = decodeURIComponent(raw);
        new NodeURL(decodedUrl);
    } catch {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
    }

    const browser = await getBrowser();
    const context = await browser.createBrowserContext();

    try {
        const page = await context.newPage();
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
        );

        page.on('request', (req) => {
            if (['image','stylesheet','font','media','websocket','xhr','fetch'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(decodedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const html = await page.content();

        await page.close();

        const $ = cheerio.load(html);

        const meta = (prop: string) => $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content') || null;

        res.json({
            title: meta('og:title') || meta('twitter:title') || $('title').first().text() || null,
            description: meta('og:description') || meta('description') || meta('twitter:description') || null,
            image: resolveUrl(decodedUrl, meta('og:image')) || resolveUrl(decodedUrl, meta('twitter:image')),
            url: meta('og:url') || decodedUrl,
            siteName: meta('og:site_name'),
            type: meta('og:type') || null,
            success: true
        });
    } catch (error: any) {
        res.status(500).json({
            error: `Open Graph extraction failed: ${error.message}`,
            success: false
        });
    } finally {
        await context.close();
    }
});

app.listen(PORT, () => {
    console.log(`Cloud Browser API server running on port ${PORT}`);
});
