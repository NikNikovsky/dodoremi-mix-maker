import express from 'express';
import path from 'path';
import fsPromises from 'fs/promises';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[server] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

const ROOT = path.resolve(__dirname);
const SONGS_MANIFEST = path.join(ROOT, 'docs', 'songs-manifest.json');
const SONGS_DIR = path.join(ROOT, 'songs');

app.get('/api/manifest', async (req, res) => {
  console.log(`[server] GET /api/manifest from ${req.ip}`);
  try {
    const body = await fsPromises.readFile(SONGS_MANIFEST, 'utf8');
    res.type('json').send(body);
  } catch (err) {
    res.status(500).json({ error: 'Could not read manifest' });
  }
});

// diagnostic endpoint: called by the frontend on mount to confirm client is running
app.post('/api/_client_loaded', (req, res) => {
  console.log(`[server] client loaded from ${req.ip}`);
  if (req.body && Object.keys(req.body).length) {
    console.log('[server] client payload:', req.body);
  }
  res.json({ ok: true });
});

app.get('/api/song/:slug', async (req, res) => {
  try {
    console.log(`[server] GET /api/song/${req.params.slug} from ${req.ip}`);
    const slug = req.params.slug;
    const configPath = path.join(SONGS_DIR, slug, 'config.json');
    const body = await fsPromises.readFile(configPath, 'utf8');
    res.type('json').send(body);
  } catch (err) {
    res.status(404).json({ error: 'Song not found' });
  }
});

app.post('/api/song', async (req, res) => {
  try {
    const config = req.body;
    if (!config || !config.slug) return res.status(400).json({ error: 'Missing slug' });
    const slug = String(config.slug);
    const songDir = path.join(SONGS_DIR, slug);
    await fsPromises.mkdir(songDir, { recursive: true });
    const configPath = path.join(songDir, 'config.json');
    await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    // write empty locale files
    const locales = ['en.json','de.json','es.json','fr.json','it.json'];
    for (const l of locales) {
      const p = path.join(songDir, l);
      try { await fs.writeFile(p, JSON.stringify({}, null, 2), { flag: 'wx' }); } catch(e) { /* ignore if exists */ }
    }

    // update manifest
    try {
      const manifestBody = await fsPromises.readFile(SONGS_MANIFEST, 'utf8');
      const manifest = JSON.parse(manifestBody);
      if (!manifest.songs) manifest.songs = [];
      if (!manifest.songs.includes(slug)) {
        manifest.songs.push(slug);
        await fsPromises.writeFile(SONGS_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
      }
    } catch (e) {
      // ignore manifest update failure
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// serve frontend built files when present
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// fallback to root index.html if available (helpful for running without Vite dev server)
app.get('/', async (req, res) => {
  try {
    const indexFile = path.join(__dirname, 'dist', 'index.html');
    const exists = await fsPromises.stat(indexFile).then(() => true).catch(() => false);
    if (exists) return res.sendFile(indexFile);
    // if no build, give a helpful message
    return res.send('No frontend build available. Run `npm run dev` for development UI at http://localhost:5173');
  } catch (e) {
    return res.status(500).send('Server error');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
