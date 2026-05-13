import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

const ARCHIVE_PATH = process.env.ARCHIVE_PATH || '/app/archive';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { path: filePath } = req.query;

    if (!filePath || typeof filePath === 'string') {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    // Reconstruct the file path and validate it's within archive
    const normalizedPath = filePath.join('/');
    const fullPath = path.join(ARCHIVE_PATH, normalizedPath);

    // Security: ensure path is within archive
    if (!fullPath.startsWith(ARCHIVE_PATH)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if it's a JSON file - read as text
    if (fullPath.endsWith('.json')) {
      const content = await fsp.readFile(fullPath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(content);
      return;
    }

    // For media files - support range requests and stream
    const stat = await fsp.stat(fullPath);
    if (stat.isFile()) {
      const range = req.headers.range;

      // Basic mime mapping for common types
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        m4v: 'video/x-m4v',
        mov: 'video/quicktime',
        webm: 'video/webm',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
      };

      const contentType = mimeMap[ext] || 'application/octet-stream';

      if (range) {
        const bytesPrefix = 'bytes=';
        const rangeStr = Array.isArray(range) ? range[0] : range;
        if (!rangeStr.startsWith(bytesPrefix)) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
          return;
        }

        const parts = rangeStr.replace(bytesPrefix, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        if (isNaN(start) || isNaN(end) || start > end || start >= stat.size) {
          res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
          return;
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
        });

        const stream = fs.createReadStream(fullPath, { start, end });
        stream.pipe(res);
        stream.on('error', (err) => {
          console.error('Stream error:', err);
          try {
            res.end();
          } catch (e) {
            console.error('Error ending response after stream error:', e);
          }
        });
        return;
      }

      // No range - stream entire file
      res.writeHead(200, {
        'Content-Length': String(stat.size),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        try {
          res.end();
        } catch (e) {
          console.error('Error ending response after stream error:', e);
        }
      });
      return;
    }

    res.status(404).json({ error: 'File not found' });
  } catch (error: any) {
    console.error('File serve error:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to read file' });
    }
  }
}
