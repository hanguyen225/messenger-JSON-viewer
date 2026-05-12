export async function findInboxFolder(dir: FileSystemDirectoryHandle) {
  const dirs: FileSystemDirectoryHandle[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      dirs.push(entry);
    }
  }

  const inbox = dirs.find((dir) => dir.name === 'inbox');
  if (inbox) {
    return inbox;
  }
}
export async function getSubDirs(dir: FileSystemDirectoryHandle) {
  const entries: FileSystemDirectoryHandle[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      entries.push(entry);
    }
  }

  return entries;
}

export async function readMessageJSON(dir: FileSystemDirectoryHandle) {
  try {
    // Gather all files that match message*.json (e.g., message_1.json, message_2.json)
    const fileHandles: FileSystemFileHandle[] = [];
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && /^message.*\.json$/i.test(entry.name)) {
        fileHandles.push(entry);
      }
    }

    if (fileHandles.length === 0) {
      return null;
    }

    // Sort by numeric suffix if present, otherwise by filename
    fileHandles.sort((a, b) => {
      const na = (a.name.match(/message(?:_?(\d+))?\.json/i) || [])[1];
      const nb = (b.name.match(/message(?:_?(\d+))?\.json/i) || [])[1];
      if (na && nb) {
        return parseInt(na, 10) - parseInt(nb, 10);
      }
      if (na) return -1;
      if (nb) return 1;
      return a.name.localeCompare(b.name);
    });

    // Read and merge messages arrays
    const combined: any = {
      participants: [],
      title: '',
      messages: [],
    };

    for (const fh of fileHandles) {
      try {
        const text = await (await fh.getFile()).text();
        const json = JSON.parse(text);
        if (!combined.title) combined.title = json.title || combined.title;
        if (json.participants && combined.participants.length === 0) {
          combined.participants = json.participants;
        }
        if (Array.isArray(json.messages)) {
          combined.messages = combined.messages.concat(json.messages);
        }
      } catch (e) {
        // ignore individual file parse errors
      }
    }

    // Deduplicate messages by timestamp + sender + content (best-effort), then sort ascending
    const seen = new Set();
    const deduped: any[] = [];
    for (const m of combined.messages) {
      const key = `${m.timestamp_ms || 0}-${
        m.sender_name || ''
      }-${JSON.stringify(m.content || m.photos || m.videos || m.audio || '')}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(m);
      }
    }

    combined.messages = deduped.sort(
      (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
    );

    return JSON.stringify(combined);
  } catch (e) {
    return null;
  }
}

export async function readAutofillInformation(dir: FileSystemDirectoryHandle) {
  try {
    const file = await dir.getFileHandle('autofill_information.json');

    return (await file.getFile()).text();
  } catch (e) {
    return null;
  }
}

export async function getFileHandleRecursively(
  root: FileSystemDirectoryHandle,
  path: string,
  folderHints: string[] = []
): Promise<FileSystemFileHandle | null> {
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalizedPath.split('/');
  const fileName = parts[parts.length - 1] || normalizedPath;
  const lowerFileName = fileName.toLowerCase();

  if (parts.length === 0) {
    return null;
  }

  try {
    if (parts.length === 1) {
      return await root.getFileHandle(parts[0]);
    }

    const dir = await root.getDirectoryHandle(parts[0]);
    return getFileHandleRecursively(dir, parts.slice(1).join('/'), folderHints);
  } catch {
    const preferredFolders = Array.from(
      new Set(
        folderHints.map((hint) =>
          hint.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        )
      )
    ).filter(Boolean);

    for (const folderName of preferredFolders) {
      try {
        const folderHandle = await root.getDirectoryHandle(folderName);
        const foundInPreferredFolder = await findFileByName(
          folderHandle,
          lowerFileName
        );
        if (foundInPreferredFolder) {
          return foundInPreferredFolder;
        }
      } catch {
        // ignore missing preferred folders
      }
    }

    const foundByName = await findFileByName(root, lowerFileName);
    if (foundByName) {
      return foundByName;
    }

    return null;
  }
}

async function findFileByName(
  dir: FileSystemDirectoryHandle,
  targetName: string
): Promise<FileSystemFileHandle | null> {
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase() === targetName) {
      return entry;
    }

    if (entry.kind === 'directory') {
      const found = await findFileByName(entry, targetName);
      if (found) {
        return found;
      }
    }
  }

  return null;
}
