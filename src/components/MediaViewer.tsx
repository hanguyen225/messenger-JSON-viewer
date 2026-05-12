import { useEffect, useState } from 'react';
import { getFileHandleRecursively } from '@/lib/utils/file';
import { MediaItemWithTimestamp } from '@/lib/utils/message';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@heroicons/react/outline';

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
}: {
  mediaItems: MediaItemWithTimestamp[];
  initialIndex: number;
  rootDir: FileSystemDirectoryHandle;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaItems.length, onClose]);

  const goNext = () => {
    setCurrentIndex((prev) =>
      prev < mediaItems.length - 1 ? prev + 1 : 0
    );
  };

  const goPrev = () => {
    setCurrentIndex((prev) =>
      prev > 0 ? prev - 1 : mediaItems.length - 1
    );
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'>
      {/* Close button */}
      <button
        onClick={onClose}
        className='absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition'
        title='Close (Esc)'
      >
        <XIcon width={24} className='text-white' />
      </button>

      {/* Counter */}
      <div className='absolute top-4 left-4 text-white text-sm font-medium bg-black/50 px-3 py-1 rounded'>
        {currentIndex + 1} / {mediaItems.length}
      </div>

      {/* Main content */}
      <div className='flex items-center justify-center h-full w-full'>
        {/* Previous button */}
        <button
          onClick={goPrev}
          className='absolute left-4 p-3 rounded-full hover:bg-white/10 transition disabled:opacity-50'
          title='Previous (← Arrow)'
        >
          <ChevronLeftIcon width={32} className='text-white' />
        </button>

        {/* Media display */}
        <div className='flex flex-col items-center gap-4 max-w-4xl max-h-screen px-20'>
          {loading && (
            <div className='text-white text-center'>Loading...</div>
          )}

          {!loading && isAudio && (
            <div className='flex flex-col items-center gap-4'>
              <div className='text-6xl'>🔊</div>
              <div className='text-white text-center'>
                <p className='font-semibold'>{currentItem.name || 'Audio File'}</p>
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
                  className='max-w-full max-h-screen rounded'
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt='media'
                  className='max-w-full max-h-screen rounded object-contain'
                />
              )}
              <p className='text-white text-sm text-center'>
                {new Date(currentItem.timestamp_ms).toLocaleString()}
              </p>
            </>
          )}

          {!loading && !mediaUrl && !isAudio && (
            <div className='text-white text-center'>
              <p>Failed to load media</p>
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={goNext}
          className='absolute right-4 p-3 rounded-full hover:bg-white/10 transition disabled:opacity-50'
          title='Next (→ Arrow)'
        >
          <ChevronRightIcon width={32} className='text-white' />
        </button>
      </div>
    </div>
  );
}
