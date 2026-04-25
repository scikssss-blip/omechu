export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { query, site } = req.query;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  let url, headers = {}, result;

  if (site === 'unsplash') {
    url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`;
    headers = { Authorization: 'Client-ID U-qCCdy0U4XaobKWxKWWa8x4N2x_Km6UM4jn3T932_k' };
    const r = await fetch(url, { headers });
    const d = await r.json();
    result = { photos: (d.results || []).map(p => ({ src: { medium: p.urls.small, large: p.urls.regular }, alt: p.alt_description || query })) };
  } else if (site === 'pixabay') {
    url = `https://pixabay.com/api/?key=55591606-554d57e4cfb9d6d994e87a6ba&q=${encodeURIComponent(query)}&per_page=20&image_type=photo&orientation=horizontal`;
    const r = await fetch(url);
    const d = await r.json();
    result = { photos: (d.hits || []).map(p => ({ src: { medium: p.webformatURL, large: p.largeImageURL }, alt: p.tags })) };
  } else {
    url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`;
    headers = { Authorization: 'YFgee7RgZYmjnYKlQsVpa7AeE0QWO2o4rNcS1qXJQ0TjmrfAM14GtY3s' };
    const r = await fetch(url, { headers });
    result = await r.json();
  }

  res.status(200).json(result);
}
