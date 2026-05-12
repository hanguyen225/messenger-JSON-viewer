/* eslint-disable @next/next/no-img-element */
import cx from 'clsx';
import { Popover } from 'react-tiny-popover';
import { SRLWrapper } from 'simple-react-lightbox';
import useSWR from 'swr';

import useToggle from '@/lib/hooks/useToggle';
import { getFileHandleRecursively } from '@/lib/utils/file';
import { decodeString, useGroupedActorsByReaction } from '@/lib/utils/message';

import FsImage from './FsImage';
import { Message, MessageType } from '../types';

type ResolvedMediaItem = {
  src: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  key: string;
};

type MediaSource =
  | 'photos'
  | 'videos'
  | 'audio'
  | 'audio_files'
  | 'files'
  | 'gifs'
  | 'media';

type MediaItem = {
  uri: string;
  source: MediaSource;
  name?: string;
};

const ATTACHMENT_FOLDER_HINTS: Record<MediaSource, string[]> = {
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

function getMediaKind(uri: string, source: MediaSource) {
  if (source === 'files') {
    return 'file' as const;
  }

  const extension = uri.split('.').pop()?.toLowerCase();

  if (['mp4', 'webm', 'mov', 'm4v'].includes(extension || '')) {
    return 'video' as const;
  }

  if (['mp3', 'wav', 'aac', 'ogg', 'm4a'].includes(extension || '')) {
    return 'audio' as const;
  }

  return 'image' as const;
}

function getMessageMediaItems(message: Message) {
  return [
    ...(message.media || []).map((item) => ({
      ...item,
      source: 'media' as const,
    })),
    ...(message.photos || []).map((item) => ({
      ...item,
      source: 'photos' as const,
    })),
    ...(message.videos || []).map((item) => ({
      ...item,
      source: 'videos' as const,
    })),
    ...(message.audio || []).map((item) => ({
      ...item,
      source: 'audio' as const,
    })),
    ...(message.audio_files || []).map((item) => ({
      ...item,
      source: 'audio_files' as const,
    })),
    ...(message.files || []).map((item) => ({
      ...item,
      source: 'files' as const,
    })),
    ...(message.gifs || []).map((item) => ({
      ...item,
      source: 'gifs' as const,
    })),
  ] as MediaItem[];
}

function ReactionButton({
  reaction,
  actors,
}: {
  reaction: string;
  actors: string[];
}) {
  const [isPopoverOpen, setPopoverOpen, togglePopover] = useToggle(false);

  return (
    <Popover
      isOpen={isPopoverOpen}
      positions={['top']}
      padding={10}
      content={() => (
        <div className='rounded bg-gray-600 py-0.5 px-1 text-white'>
          {actors.map(decodeString).join(', ')}
        </div>
      )}
      onClickOutside={() => setPopoverOpen(false)}
    >
      <span onClick={togglePopover}>{decodeString(reaction)}</span>
    </Popover>
  );
}

function BaseMessage({
  children,
  isFirst,
  isLast,
  isMe,
  className,
  message,
  transparentBG,
}: {
  message: Message;
  children?: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  isMe: boolean;
  className?: string;
  transparentBG?: boolean;
}) {
  const [isPopoverOpen, setPopoverOpen, togglePopover] = useToggle(false);
  const groupedActions = useGroupedActorsByReaction(message);

  return (
    <div
      className={cx('flex', {
        'justify-end': isMe,
      })}
    >
      <Popover
        isOpen={isPopoverOpen}
        positions={['left']}
        padding={10}
        content={() => (
          <div className='rounded bg-gray-600 py-0.5 px-1 text-white'>
            {new Date(message.timestamp_ms).toLocaleString()}
          </div>
        )}
        onClickOutside={() => setPopoverOpen(false)}
      >
        <div
          className={cx(
            'relative whitespace-pre-wrap rounded-2xl px-4 py-2',
            {
              'rounded-r-md  text-white ': isMe,
              'bg-blue-400 dark:bg-blue-700': isMe && !transparentBG,
              'rounded-l-md dark:bg-slate-800': !isMe,
              'bg-gray-200': !isMe && !transparentBG,
              'rounded-tl-2xl': isFirst && !isMe,
              'rounded-bl-2xl': isLast && !isMe,
              'rounded-tr-2xl': isFirst && isMe,
              'rounded-br-2xl': isLast && isMe,
              'bg-transparent dark:bg-transparent': transparentBG,
            },
            className
          )}
          onClick={() => {
            togglePopover();
          }}
        >
          {children}

          {groupedActions && (
            <div className='absolute right-2 -bottom-5 select-none rounded-2xl bg-white px-2 py-0.5 shadow dark:bg-slate-800'>
              {Object.entries(groupedActions).map(([reaction, actors]) => (
                <ReactionButton
                  key={reaction}
                  reaction={reaction}
                  actors={actors}
                />
              ))}
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}

export default function MessageComponent({
  message,
  isFirst,
  isLast,
  isMe,
  rootDir,
  highlightQuery,
}: {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  isMe: boolean;
  rootDir: FileSystemDirectoryHandle;
  highlightQuery?: string;
}) {
  function renderHighlighted(text: string) {
    if (!highlightQuery) return text;
    const q = highlightQuery.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    if (!q) return text;
    const regex = new RegExp(q, 'gi');
    const parts: Array<string | JSX.Element> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
      parts.push(
        <mark key={lastIndex} className='bg-yellow-200 dark:bg-yellow-600'>
          {text.slice(idx, idx + match[0].length)}
        </mark>
      );
      lastIndex = idx + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }
  const content = decodeString(message.content || '');
  const messageType = message.type ?? MessageType.Generic;
  const mediaItems = getMessageMediaItems(message);
  const { data: imageURIs } = useSWR(
    () => (mediaItems.length ? `/message/media/${message.timestamp_ms}` : null),
    async () => {
      if (!mediaItems.length) {
        return [];
      }

      const images = await Promise.all(
        mediaItems.map(async (mediaItem) => {
          const uri = normalizeAttachmentPath(mediaItem.uri);
          const fileHandle = await getFileHandleRecursively(
            rootDir,
            uri,
            ATTACHMENT_FOLDER_HINTS[mediaItem.source]
          );
          if (!fileHandle) {
            return null;
          }
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          return {
            src: url,
            kind: getMediaKind(mediaItem.uri, mediaItem.source),
            key: uri,
          } as ResolvedMediaItem;
        })
      );

      return images.filter(Boolean) as ResolvedMediaItem[];
    }
  );

  const renderDefault = () => (
    <BaseMessage
      isFirst={isFirst}
      isLast={isLast}
      isMe={isMe}
      message={message}
    >
      {renderHighlighted(content)}
    </BaseMessage>
  );

  const renderNotImplemented = () => (
    <BaseMessage
      isFirst={isFirst}
      isLast={isLast}
      isMe={isMe}
      className='bg-red-500 text-white dark:bg-red-700'
      message={message}
    >
      Not implemented
      <pre className='mt-3 whitespace-pre-wrap text-xs'>
        <code>{JSON.stringify(message)}</code>
      </pre>
    </BaseMessage>
  );

  if (mediaItems.length) {
    return (
      <SRLWrapper>
        <BaseMessage
          isFirst={isFirst}
          isLast={isLast}
          isMe={isMe}
          message={message}
        >
          {imageURIs && imageURIs.length > 0
            ? imageURIs.map((media) => (
                <div key={media.key} className='mb-2 last:mb-0'>
                  {media.kind === 'image' ? (
                    <a href={media.src} target='_blank' rel='noreferrer'>
                      <img src={media.src} alt={media.key} />
                    </a>
                  ) : media.kind === 'video' ? (
                    <video controls className='max-w-full rounded-xl'>
                      <source src={media.src} />
                    </video>
                  ) : media.kind === 'audio' ? (
                    <audio controls className='w-full'>
                      <source src={media.src} />
                    </audio>
                  ) : (
                    <a
                      href={media.src}
                      target='_blank'
                      rel='noreferrer'
                      className='underline'
                    >
                      Open file
                    </a>
                  )}
                </div>
              ))
            : content}
        </BaseMessage>
      </SRLWrapper>
    );
  }

  if (message.sticker) {
    return (
      <BaseMessage
        isFirst={isFirst}
        isLast={isLast}
        isMe={isMe}
        message={message}
        transparentBG
      >
        <FsImage
          root={rootDir}
          path={normalizeAttachmentPath(message.sticker.uri)}
        />
      </BaseMessage>
    );
  }

  switch (messageType) {
    case MessageType.Generic: {
      if (message.content) {
        return renderDefault();
      } else {
        return renderDefault();
      }
    }
    case MessageType.Share: {
      if (message.share?.link) {
        return (
          <BaseMessage
            isFirst={isFirst}
            isLast={isLast}
            isMe={isMe}
            message={message}
          >
            <a
              href={message.share.link}
              target='_blank'
              rel='noreferrer'
              className='underline'
            >
              {content}
            </a>
          </BaseMessage>
        );
      } else {
        return renderDefault();
      }
    }
    default:
      return renderNotImplemented();
  }
}
