import { useEffect, useState } from 'react';
import { getFileHandleRecursively } from '@/lib/utils/file';
import { MediaItemWithTimestamp } from '@/lib/utils/message';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  LinkIcon,
} from '@heroicons/react/outline';

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

export default function MediaViewer({
  mediaItems,
  initialIndex,
  rootDir,
  onClose,
  onJumpToMessage,
}: {
  mediaItems: MediaItemWithTimestamp[];
  initialIndex: number;
  rootDir: FileSystemDirectoryHandle;
  onClose: () => void;
  onJumpToMessage?: (item: MediaItemWithTimestamp) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touchStart, setTouchStart] = useState(0);

  const currentItem = mediaItems[currentIndex];
  const isVideo = ['videos'].includes(currentItem.source);
  const isAudio = ['audio', 'audio_files'].includes(currentItem.source);

  useEffect(() => {
    setLoading(true);
    setMediaUrl(null);

    const loadMedia = async () => {
      try {
        const normalizedUri = normalizeAttachmentPath(currentItem.uri);
        const hints = ATTACHMENT_FOLDER_HINTS[currentItem.source] || [];

        const fileHandle = await getFileHandleRecursively(
          rootDir,
          normalizedUri,
          hints
        );

        if (fileHandle) {
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          setMediaUrl(url);
        }
      } catch (err) {
        console.error('Failed to load media:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMedia();

    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [currentItem, rootDir]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) =>
          prev > 0 ? prev - 1 : mediaItems.length - 1
        );
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) =>
          prev < mediaItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      setTouchStart(e.touches[0]?.clientX || 0);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEnd = e.changedTouches[0]?.clientX || 0;
      const diff = touchStart - touchEnd;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          // Swiped left -> next
          setCurrentIndex((prev) =>
            prev < mediaItems.length - 1 ? prev + 1 : 0
          );
        } else {
          // Swiped right -> previous
          setCurrentIndex((prev) =>
            prev > 0 ? prev - 1 : mediaItems.length - 1
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mediaItems.length, onClose, touchStart]);

  const goNext = () => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'>
      {/* Close button */}
      <button
        onClick={onClose}
        className='absolute top-4 right-4 rounded-full p-2 transition hover:bg-white/10'
        title='Close (Esc)'
      >
        <XIcon width={24} className='text-white' />
      </button>

      {/* Jump to message button */}
      {onJumpToMessage && (
        <button
          onClick={() => onJumpToMessage(currentItem)}
          className='absolute top-4 right-16 hidden items-center gap-2 rounded-full bg-blue-600 p-2 transition hover:bg-blue-700 sm:flex'
          title='Jump to message'
        >
          <LinkIcon width={24} className='text-white' />
        </button>
      )}

      {/* Counter */}
      <div className='absolute top-4 left-4 rounded bg-black/50 px-3 py-1 text-sm font-medium text-white'>
        {currentIndex + 1} / {mediaItems.length}
      </div>

      {/* Main content */}
      <div className='flex h-full w-full items-center justify-center'>
        {/* Previous button */}
        <button
          onClick={goPrev}
          className='absolute left-4 rounded-full p-2 transition hover:bg-white/10 disabled:opacity-50 sm:p-3'
          title='Previous (← Arrow / Swipe)'
        >
          <ChevronLeftIcon width={24} className='text-white sm:w-8' />
        </button>

        {/* Media display */}
        <div className='flex max-h-screen max-w-4xl flex-col items-center gap-4 px-20'>
          {loading && <div className='text-center text-white'>Loading...</div>}

          {!loading && isAudio && (
            <div className='flex flex-col items-center gap-4'>
              <div className='text-6xl'>🔊</div>
              <div className='text-center text-white'>
                <p className='font-semibold'>
                  {currentItem.name || 'Audio File'}
                </p>
                <p className='text-sm text-gray-400'>
                  {new Date(currentItem.timestamp_ms).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {!loading && !isAudio && mediaUrl && (
            <>
              {isVideo ? (
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  className='max-h-screen max-w-full rounded'
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt='media'
                  className='max-h-screen max-w-full rounded object-contain'
                />
              )}
              <p className='text-center text-sm text-white'>
                {new Date(currentItem.timestamp_ms).toLocaleString()}
              </p>
            </>
          )}

          {!loading && !mediaUrl && !isAudio && (
            <div className='text-center text-white'>
              <p>Failed to load media</p>
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={goNext}
          className='absolute right-4 rounded-full p-2 transition hover:bg-white/10 disabled:opacity-50 sm:p-3'
          title='Next (→ Arrow / Swipe)'
        >
          <ChevronRightIcon width={24} className='text-white sm:w-8' />
        </button>
      </div>
    </div>
  );
}
