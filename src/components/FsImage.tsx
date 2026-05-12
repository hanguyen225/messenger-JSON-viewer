import React from 'react';
import useSWR from 'swr';

import { getFileHandleRecursively } from '@/lib/utils/file';

export default function FsImage({
  path,
  root,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  path: string;
  root: FileSystemDirectoryHandle;
}) {
  const { data: src } = useSWR(['images', path], async () => {
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
      path,
      ATTACHMENT_HINTS
    );
    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    return url;
  });

  if (!src) {
    return null;
  }

  return <img src={src} {...props} />;
}
