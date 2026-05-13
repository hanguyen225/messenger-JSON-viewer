import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
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
      const content = await fs.readFile(fullPath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(content);
      return;
    }

    // For media files - stream them
    const stat = await fs.stat(fullPath);
    if (stat.isFile()) {
      const content = await fs.readFile(fullPath);
      res.setHeader('Content-Length', stat.size);
      res.status(200).send(content);
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
