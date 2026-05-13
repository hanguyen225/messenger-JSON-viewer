import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

type ResponseData = {
  chats?: Array<{
    dirName: string;
    title: string;
    lastSent: number;
    image?: string;
  }>;
  error?: string;
};

const ARCHIVE_PATH = process.env.ARCHIVE_PATH || '/app/archive';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Check if archive path exists
    try {
      await fs.access(ARCHIVE_PATH);
    } catch {
      // Archive path doesn't exist - return 404 to indicate server mode unavailable
      res.status(404).json({ error: 'Archive path not found' });
      return;
    }

    // Read inbox directory
    const inboxPath = path.join(ARCHIVE_PATH, 'inbox');
    let entries: any[];
    try {
      entries = await fs.readdir(inboxPath, { withFileTypes: true });
    } catch {
      // Inbox doesn't exist - return 404
      res.status(404).json({ error: 'Inbox directory not found' });
      return;
    }

    // Get all subdirectories (chat folders)
    const chatDirs = entries.filter((e) => e.isDirectory());

    // Read metadata from each chat folder in parallel
    const chatResults = await Promise.all(
      chatDirs.map(async (dir) => {
        try {
          const messagePath = path.join(inboxPath, dir.name, 'message_1.json');
          const messageText = await fs.readFile(messagePath, 'utf-8');
          const messageJson = JSON.parse(messageText);

          const title = messageJson.title || dir.name;
          const image = messageJson.image?.uri;
          const messages = messageJson.messages || [];
          const lastSent =
            messages.length > 0
              ? Math.max(...messages.map((m: any) => m.timestamp_ms || 0))
              : 0;

          return {
            dirName: dir.name,
            title,
            lastSent,
            image,
          };
        } catch (e) {
          // Skip folders without message_1.json
          return null;
        }
      })
    );

    const chats = chatResults.filter(Boolean) as NonNullable<ResponseData['chats']>;

    // Sort by last sent time
    chats.sort((a, b) => b.lastSent - a.lastSent);

    res.status(200).json({ chats });
  } catch (error) {
    console.error('Archive list error:', error);
    res.status(500).json({ error: 'Failed to read archive' });
  }
}
