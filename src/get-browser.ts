import puppeteer, { Browser } from 'puppeteer';


let browserPromise: Promise<Browser> | null = null;

export async function getBrowser() {
    if (!browserPromise) {
        browserPromise = puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        }).then(b => {
            b.on('disconnected', () => {
                browserPromise = null;
            });
            return b;
        })
    }

    return browserPromise;
}
