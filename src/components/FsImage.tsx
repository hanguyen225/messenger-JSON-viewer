import React, { useMemo } from 'react';
import useSWR from 'swr';

import { getFileHandleRecursively } from '@/lib/utils/file';
import { useArchiveMode } from '@/lib/context/ArchiveContext';
import { getServerFile, normalizeArchivePath } from '@/lib/utils/serverFile';

export default function FsImage({
  path,
  root,
  folderName,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  path: string;
  root?: FileSystemDirectoryHandle;
  folderName?: string;
}) {
  const { mode: archiveMode } = useArchiveMode();
  const normalizedPath = normalizeArchivePath(path);

  const { data: src } = useSWR(
    () => {
      if (archiveMode === 'server' && folderName) {
        return ['images-server', folderName, normalizedPath];
      }
      return root ? ['images', normalizedPath] : null;
    },
    async () => {
      if (archiveMode === 'server' && folderName) {
        // Load from server
        const blob = await getServerFile(folderName, normalizedPath);
        if (blob) {
          return URL.createObjectURL(blob);
        }
        return null;
      } else if (root) {
        // Load from local filesystem
        const ATTACHMENT_HINTS = [
          'photos',
          'photo',
          'video',
          'videos',
          'audio',
          'files',
          'gifs',
        ];
        const fileHandle = await getFileHandleRecursively(
          root,
          normalizedPath,
          ATTACHMENT_HINTS
        );
        if (!fileHandle) {
          return null;
        }

        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        return url;
      }
      return null;
    }
  );

  if (!src) {
    return null;
  }

  return <img src={src} {...props} />;
}
