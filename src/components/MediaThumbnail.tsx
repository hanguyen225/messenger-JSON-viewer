import { useEffect, useState } from 'react';
import { getFileHandleRecursively } from '@/lib/utils/file';
import { MediaItemWithTimestamp } from '@/lib/utils/message';

const ATTACHMENT_FOLDER_HINTS: Record<string, string[]> = {
  photos: ['photo', 'photos'],
  videos: ['video', 'videos'],
  audio: ['audio'],
  audio_files: ['audio'],
  files: ['files', 'file'],
  gifs: ['gifs', 'gif'],
  media: [
    'media',
    'photo',
    'photos',
    'video',
    'videos',
    'audio',
    'files',
    'gifs',
  ],
};

function normalizeAttachmentPath(uri: string) {
  return uri.replace(/^messages[\\/]/, '').replace(/\\/g, '/');
}

export default function MediaThumbnail({
  item,
  rootDir,
  isVideo,
  isAudio,
  onClick,
}: {
  item: MediaItemWithTimestamp;
  rootDir: FileSystemDirectoryHandle;
  isVideo: boolean;
  isAudio: boolean;
  onClick?: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadMedia = async () => {
      try {
        const normalizedUri = normalizeAttachmentPath(item.uri);
        const hints = ATTACHMENT_FOLDER_HINTS[item.source] || [];

        const fileHandle = await getFileHandleRecursively(
          rootDir,
          normalizedUri,
          hints
        );

        if (fileHandle && mounted) {
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          setImageUrl(url);
          setError(false);
        } else if (mounted) {
          setError(true);
        }
      } catch (err) {
        if (mounted) {
          setError(true);
        }
      }
    };

    loadMedia();

    return () => {
      mounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [item.uri, item.source, rootDir]);

  if (isAudio) {
    return (
      <button
        onClick={onClick}
        className='flex h-12 flex-col items-center justify-center rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 cursor-pointer transition'
        title={item.name || item.uri}
      >
        <div className='text-xl'>🔊</div>
        <small className='max-w-full overflow-hidden text-ellipsis text-xs'>
          {item.name || 'audio'}
        </small>
      </button>
    );
  }

  if (error) {
    return (
      <button
        onClick={onClick}
        className='relative overflow-hidden rounded bg-gray-300 dark:bg-gray-700 cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-600 transition'
        style={{ paddingBottom: '100%' }}
      >
        <div className='absolute inset-0 flex items-center justify-center'>
          <span className='text-gray-500'>✗</span>
        </div>
        {isVideo && (
          <div className='absolute top-1 right-1 text-lg'>▶</div>
        )}
      </button>
    );
  }

  if (!imageUrl) {
    return (
      <div className='relative overflow-hidden rounded bg-gray-200 dark:bg-gray-700 animate-pulse' style={{ paddingBottom: '100%' }}>
        <div className='absolute inset-0' />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className='relative overflow-hidden rounded bg-gray-200 dark:bg-gray-700 cursor-pointer hover:opacity-80 transition'
      style={{ paddingBottom: '100%' }}
      title={item.name || item.uri}
    >
      <div className='absolute inset-0'>
        <img
          src={imageUrl}
          alt={item.name || 'media'}
          className='h-full w-full object-cover'
        />
        {isVideo && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
            <div className='text-2xl text-white'>▶</div>
          </div>
        )}
      </div>
    </button>
  );
}
