export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { query, site } = req.query;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  let result;

  if (site === 'unsplash') {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`,
      { headers: { Authorization: 'Client-ID U-qCCdy0U4XaobKWxKWWa8x4N2x_Km6UM4jn3T932_k' } }
    );
    const d = await r.json();
    result = { photos: (d.results || []).map(p => ({ src: { medium: p.urls.small, large: p.urls.regular }, alt: p.alt_description || query })) };

  } else if (site === 'pixabay') {
    const r = await fetch(
      `https://pixabay.com/api/?key=55591606-554d57e4cfb9d6d994e87a6ba&q=${encodeURIComponent(query)}&per_page=20&image_type=photo&orientation=horizontal`
    );
    const d = await r.json();
    result = { photos: (d.hits || []).map(p => ({ src: { medium: p.webformatURL, large: p.largeImageURL }, alt: p.tags })) };

  } else if (site === 'wikipedia') {
    // 한국어 Wikipedia 먼저, 없으면 영어
    const tryWiki = async (lang, title) => {
      const r = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800`
      );
      const d = await r.json();
      const page = Object.values(d.query.pages)[0];
      return page.thumbnail?.source || null;
    };
    const isEng = /^[A-Z]/.test(query);
    let url = isEng ? await tryWiki('en', query) : (await tryWiki('ko', query) || await tryWiki('en', query));
    result = { photos: url ? [{ src: { medium: url, large: url }, alt: query }] : [] };

  } else {
    // Pexels (default)
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`,
      { headers: { Authorization: 'YFgee7RgZYmjnYKlQsVpa7AeE0QWO2o4rNcS1qXJQ0TjmrfAM14GtY3s' } }
    );
    result = await r.json();
  }

  res.status(200).json(result);
}
