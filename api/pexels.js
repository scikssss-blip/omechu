export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { query } = req.query;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`,
    { headers: { Authorization: 'YFgee7RgZYmjnYKlQsVpa7AeE0QWO2o4rNcS1qXJQ0TjmrfAM14GtY3s' } }
  );
  const data = await response.json();
  res.status(200).json(data);
}
