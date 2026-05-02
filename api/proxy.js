export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !url.startsWith('https://upload.wikimedia.org/')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmechuApp/1.0)',
        'Referer': 'https://en.wikipedia.org/',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Fetch failed' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
