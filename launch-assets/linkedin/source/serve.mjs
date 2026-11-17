import http from 'node:http';
import { readFileSync } from 'node:fs';
http
  .createServer((q, r) => {
    try {
      r.end(readFileSync('.' + (q.url === '/' ? '/stage.html' : q.url.split('?')[0])));
    } catch {
      r.statusCode = 404;
      r.end();
    }
  })
  .listen(5190);
