import * as cheerio from 'cheerio';
import { getBrowser } from './get-browser';
import { resolveUrl } from './resolve-url';


export async function fetchOG(url: string) {
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

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        const html = await page.content();

        await page.close();
        await context.close();

        const $ = cheerio.load(html);

        const meta = (prop: string) => $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content') || null;

        return {
            title: meta('og:title') || meta('twitter:title') || $('title').first().text() || null,
            description: meta('og:description') || meta('description') || meta('twitter:description') || null,
            image: resolveUrl(url, meta('og:image')) || resolveUrl(url, meta('twitter:image')),
            url: meta('og:url') || url,
            siteName: meta('og:site_name'),
            type: meta('og:type') || null,
        };
    } catch (error: any) {
        await context.close();
        return undefined
    }
}