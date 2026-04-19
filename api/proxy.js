import axios from 'axios';

export default async function handler(req, res) {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path parameter' });

  // Clean leading slash if any, then prepend /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${process.env.EVO_API_URL}${cleanPath}`;

  try {
    const response = await axios({
      method: req.method,
      url,
      data: req.method === 'GET' ? undefined : req.body,
      headers: {
        'apikey': process.env.EVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    return res.status(200).json(response.data);
  } catch (err) {
    return res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
}
