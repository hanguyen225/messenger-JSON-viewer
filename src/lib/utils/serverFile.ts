// Server-side file abstraction for HTTP API
export type ServerFileHandle = {
  kind: 'file';
  name: string;
  path: string;
};

export type ServerDirectoryHandle = {
  kind: 'directory';
  name: string;
  path: string;
};

const ATTACHMENT_PATH_RE = /(?:^|\/)(photos?|videos?|audio_files?|audio|files?|gifs?|sticker(?:s)?|media)\/.+$/i;

export function normalizeArchivePath(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const attachmentMatch = normalizedPath.match(ATTACHMENT_PATH_RE);

  if (attachmentMatch) {
    return attachmentMatch[0].replace(/^\//, '');
  }

  return normalizedPath
    .replace(/^.*?(?=messages[/])/i, '')
    .replace(/^messages[/]/i, '')
    .replace(/^your_facebook_activity[/]/i, '');
}

export async function getServerChats(): Promise<
  Array<{
    dirName: string;
    title: string;
    lastSent: number;
    image?: string;
  }>
> {
  try {
    const res = await fetch('/api/archive/list');
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.chats || [];
  } catch (error) {
    console.error('Failed to fetch archive list:', error);
    return [];
  }
}

export async function getServerMessageJSON(
  dirName: string
): Promise<string | null> {
  try {
    const res = await fetch(`/api/archive/messages/${dirName}`);
    if (!res.ok) {
      return null;
    }
    return res.text();
  } catch (error) {
    console.error('Failed to fetch message JSON:', error);
    return null;
  }
}

export async function getServerFile(
  dirName: string,
  filePath: string
): Promise<Blob | null> {
  try {
    const normalizedPath = normalizeArchivePath(filePath);
    const candidatePaths = [
      normalizedPath,
      dirName ? `inbox/${dirName}/${normalizedPath}` : null,
    ].filter(Boolean) as string[];

    for (const candidatePath of candidatePaths) {
      const res = await fetch(`/api/archive/files/${candidatePath}`);
      if (res.ok) {
        return res.blob();
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch file:', error);
    return null;
  }
}

/**
 * Checks if server-side archive is available
 */
export async function isServerArchiveAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/archive/health');
    return res.ok;
  } catch (error) {
    return false;
  }
}
