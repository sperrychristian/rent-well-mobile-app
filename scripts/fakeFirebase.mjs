// a tiny local stand-in for the Firebase Realtime Database REST API, plain node:http with no packages
// run it with: npm run firebase:fake   (port 9000, or --port=9100)
// then point the app at it in .env: EXPO_PUBLIC_FIREBASE_DB_URL=http://localhost:9000
// (on a phone use the computer's LAN address instead of localhost)
// the data only lives in memory, so stopping the server empties it, seed it with:
//   npm run firebase:seed -- --url=http://localhost:9000
// for checking loading and error screens:
//   --delay=1500   waits that long before every answer
//   POST /__delay?ms=1500, POST /__fail?status=500 (0 turns it off), POST /__reset
import http from 'node:http';
import { createFakeDatabase } from './fakeDatabase.js';

function argValue(name, fallback) {
  const found = process.argv.find((arg) => arg.startsWith('--' + name + '='));
  return found ? found.split('=')[1] : fallback;
}

export function startFakeFirebase(options) {
  const settings = options || {};
  const database = createFakeDatabase(settings.initial || null);
  const state = { delay_ms: Number(settings.delay_ms || 0), fail_status: 0 };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // CORS, so the web render of the app can call it from another port
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, if-match, X-Firebase-ETag');
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    // the switches for visual checks
    if (url.pathname === '/__delay') {
      state.delay_ms = Number(url.searchParams.get('ms') || 0);
      res.writeHead(200);
      res.end('delay ' + state.delay_ms);
      return;
    }
    if (url.pathname === '/__fail') {
      state.fail_status = Number(url.searchParams.get('status') || 0);
      res.writeHead(200);
      res.end('fail ' + state.fail_status);
      return;
    }
    if (url.pathname === '/__reset') {
      database.reset(null);
      res.writeHead(200);
      res.end('reset');
      return;
    }
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
    });
    req.on('end', () => {
      setTimeout(() => {
        if (!url.pathname.endsWith('.json')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Paths end in .json' }));
          return;
        }
        if (state.fail_status) {
          res.writeHead(state.fail_status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forced failure' }));
          return;
        }
        let body;
        try {
          body = text ? JSON.parse(text) : undefined;
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid data; could not parse JSON.' }));
          return;
        }
        const path = url.pathname.replace(/\.json$/, '');
        const result = database.handle(req.method, path, body, req.headers);
        res.writeHead(result.status, {
          'Content-Type': 'application/json',
          ...(result.headers || {}),
        });
        res.end(JSON.stringify(result.body === undefined ? null : result.body));
      }, state.delay_ms);
    });
  });

  return new Promise((resolve) => {
    server.listen(settings.port === undefined ? 9000 : settings.port, () => {
      resolve({
        server,
        database,
        port: server.address().port,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// started from the command line (not imported by the check script)
if (process.argv[1] && process.argv[1].endsWith('fakeFirebase.mjs')) {
  const port = Number(argValue('port', 9000));
  const running = await startFakeFirebase({ port: port, delay_ms: argValue('delay', 0) });
  console.log('Fake Firebase on http://localhost:' + running.port + ' (in memory, Ctrl+C to stop)');
}
