const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const IMAGES_DIR = path.join(__dirname, '..', 'test-images', 'bridges');
const PORT = Number(process.env.PORT) || 3000;
const SERVER_URL = process.env.TEST_SERVER_URL || `http://localhost:${PORT}/api/vision/image-search`;

function fileToDataUrl(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeByExt = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    };

    const mime = mimeByExt[ext] || 'image/jpeg';
    const base64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${base64}`;
}

async function sendImage(filePath) {
    const imageDataUrl = fileToDataUrl(filePath);

    try {
        const res = await axios.post(
            SERVER_URL,
            {
                imageDataUrl,
                target: 'place',
                language: 'vi'
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        console.log('=== Result for', path.basename(filePath), '===');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Request failed for', path.basename(filePath), err.message);
        if (err.response) console.error('Status:', err.response.status, 'Data:', err.response.data);
    }
}

async function main() {
    console.log('Vision endpoint:', SERVER_URL);

    if (!fs.existsSync(IMAGES_DIR)) {
        console.log('No test images directory found at', IMAGES_DIR);
        console.log('Create the directory and add bridge images, e.g. backend/test-images/bridges/dragon.jpg');
        return;
    }

    const files = fs.readdirSync(IMAGES_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (!files.length) {
        console.log('No image files found in', IMAGES_DIR);
        return;
    }

    for (const file of files) {
        const full = path.join(IMAGES_DIR, file);
        await sendImage(full);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
