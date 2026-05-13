import {
  InformationCircleIcon,
  MenuIcon,
  MoonIcon,
  RefreshIcon,
  SunIcon,
  XIcon,
} from '@heroicons/react/outline';
import cx from 'clsx';
import randomColor from 'randomcolor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useSWR from 'swr';

import { useArchiveMode } from '@/lib/context/ArchiveContext';
import useTheme from '@/lib/hooks/useTheme';

import useThemeColor from '@/lib/hooks/useThemeColor';
import useToggle from '@/lib/hooks/useToggle';
import useWindowOverlay from '@/lib/hooks/useWindowOverlay';
import {
  decodeString,
  getMyselfName,
  loadChats,
  setChatCache,
  useAllMediaItems,
  useChatStatistics,
  useCurrentMessage,
  useGroupedMessages,
} from '@/lib/utils/message';
import { getServerChats, getServerMessageJSON } from '@/lib/utils/serverFile';

import Collapsible from '@/components/Collapsible';
import FsImage from '@/components/FsImage';
import MediaThumbnail from '@/components/MediaThumbnail';
import MediaViewer from '@/components/MediaViewer';
import MessageComponent from '@/components/Message';
import SearchInput from '@/components/SearchInput';

const scrollPositionStore = new Map();

function LoadingBar({ className = '' }: { className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-full bg-blue-500/20', className)}>
      <div className='loading-bar-indeterminate h-full w-1/3 rounded-full bg-blue-500' />
    </div>
  );
}

function ChatAvatar({
  chat,
  sizeClass,
  fallbackTextClassName,
}: {
  chat: {
    dirName: string;
    title: string;
    image?: string;
    dirHandle?: FileSystemDirectoryHandle | null;
  };
  sizeClass: string;
  fallbackTextClassName?: string;
}) {
  const title = decodeString(chat.title);

  if (chat.image) {
    return (
      <div
        className={cx(
          'relative overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
          sizeClass
        )}
      >
        <FsImage
          path={chat.image}
          root={chat.dirHandle ?? undefined}
          folderName={chat.dirName}
          alt={title}
          className='h-full w-full object-cover'
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        'flex select-none items-center justify-center rounded-full text-white',
        sizeClass
      )}
      style={{
        backgroundColor: randomColor({
          luminosity: 'dark',
          seed: chat.dirName,
        }),
      }}
    >
      <span className={fallbackTextClassName}>{title[0]}</span>
    </div>
  );
}

export default function HomePage() {
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [inboxDir, setInboxDir] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [search, setSearch] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarOpen, , toggleSidebar] = useToggle(false);
  const [infoPanelOpen, , toggleInfoPanel] = useToggle(false);
  const [chatMembersInfoExpanded, , toggleChatMembersInfo] = useToggle(false);
  const [messageCountExpanded, , toggleMessageCount] = useToggle(false);
  const [chatInfoExpanded, , toggleChatInfo] = useToggle(false);
  const [mediaExpanded, , toggleMedia] = useToggle(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null
  );
  const [perspectiveName, setPerspectiveName] = useState<string | null>(null);
  const [mediaTabIndex, setMediaTabIndex] = useState(0);
  const [messageCacheVersion, setMessageCacheVersion] = useState(0);

  const { mode: archiveMode, isLoading: archiveLoading } = useArchiveMode();

  const [folderName, setFolderName] = useState<string | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const currentMessage = useCurrentMessage(folderName, messageCacheVersion);
  const groupedMessages = useGroupedMessages(currentMessage);
  const chatStatistic = useChatStatistics(currentMessage);
  const mediaItems = useAllMediaItems(currentMessage);
  const { windowControlsOverlayEnable, windowControlsOverlayRect } =
    useWindowOverlay();
  const searchbarWidth = useMemo(() => {
    if (windowControlsOverlayRect?.width) {
      return windowControlsOverlayRect?.width * 0.6;
    } else {
      return 300;
    }
  }, [windowControlsOverlayRect]);

  const messageGroupRef = useRef<VirtuosoHandle>(null);

  // Track desktop screen size
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Reset search when changing chats
    setMessageSearch('');
    setMessageSearchIndex(0);
    setMediaTabIndex(0);
    const position = scrollPositionStore.get(folderName!);

    const targetIndex = position || groupedMessages.length - 1;

    // Scroll to absolute group index
    messageGroupRef.current?.scrollToIndex({
      index: Math.max(0, targetIndex),
      align: 'end',
    });
  }, [folderName, groupedMessages]);

  // Load message JSON from server when in server mode
  useEffect(() => {
    if (archiveMode === 'server' && folderName) {
      const loadServerMessages = async () => {
        const messageJSON = await getServerMessageJSON(folderName);
        if (messageJSON) {
          setChatCache(folderName, messageJSON);
          setMessageCacheVersion((version) => version + 1);
        }
      };
      loadServerMessages();
    }
  }, [archiveMode, folderName]);

  const { dark, toggleTheme, theme } = useTheme();
  const [showAllCounts, setShowAllCounts] = useState(false);
  useThemeColor({
    dark: '#121212',
    light: '#ffffff',
  });

  // Load chats based on mode
  const { data } = useSWR(
    () => {
      if (archiveMode === 'server') {
        return 'chats-server';
      }
      return inboxDir?.name && ['chats', inboxDir?.name];
    },
    async () => {
      if (archiveMode === 'server') {
        // Load from server API
        const chats = await getServerChats();
        if (chats) {
          return chats.map((chat) => ({
            ...chat,
            name: chat.title,
            lastSent: chat.lastSent,
            dirName: chat.dirName,
            image: chat.image,
            dirHandle: null,
          }));
        }
        return [];
      } else {
        // Load from local file system
        return inboxDir ? loadChats(inboxDir) : [];
      }
    }
  );
  const { data: myName = null } = useSWR(
    () => (archiveMode === 'local' && directory ? 'myName' : false),
    () => {
      return getMyselfName(directory!);
    }
  );

  const chatTitle = archiveMode === 'server' ? 'Messenger archive' : myName;

  const chats = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .sort((a, b) => b.lastSent - a.lastSent)
      .filter(
        (c) =>
          decodeString(c.title).includes(search) || c.dirName.includes(search)
      );
  }, [data, search]);

  const selectedChat = useMemo(() => {
    if (!folderName || !data) {
      return null;
    }

    return data.find((chat) => chat.dirName === folderName) ?? null;
  }, [data, folderName]);

  useEffect(() => {
    setPerspectiveName(null);
  }, [folderName]);

  const displayGroups = groupedMessages;

  // Build global list of search results across all grouped messages (not limited to window)
  const searchResults = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (!q || !groupedMessages)
      return [] as {
        groupIndex: number;
        messageIndex: number;
        start: number;
        length: number;
      }[];

    const results: {
      groupIndex: number;
      messageIndex: number;
      start: number;
      length: number;
    }[] = [];

    for (let gi = 0; gi < groupedMessages.length; gi++) {
      const group = groupedMessages[gi];
      for (let mi = 0; mi < group.length; mi++) {
        const msg = group[mi];
        const content = decodeString(msg.content || '');
        const lc = content.toLowerCase();
        let pos = lc.indexOf(q, 0);
        while (pos !== -1) {
          results.push({
            groupIndex: gi,
            messageIndex: mi,
            start: pos,
            length: q.length,
          });
          pos = lc.indexOf(q, pos + q.length);
        }
      }
    }

    return results;
  }, [groupedMessages, messageSearch]);

  // Function to jump to a message by media item
  const jumpToMediaMessage = (mediaItem: typeof mediaItems[0]) => {
    if (!currentMessage) return;

    // Find the message that contains this media
    let targetMessageIndex = -1;
    for (let i = 0; i < currentMessage.messages.length; i++) {
      const msg = currentMessage.messages[i];
      if (msg.timestamp_ms === mediaItem.timestamp_ms) {
        // Check if message contains this media
        const allMediaItems = [
          ...(msg.photos || []).map((p) => ({ uri: p.uri, source: 'photos' })),
          ...(msg.videos || []).map((v) => ({ uri: v.uri, source: 'videos' })),
          ...(msg.audio || []).map((a) => ({ uri: a.uri, source: 'audio' })),
          ...(msg.audio_files || []).map((a) => ({
            uri: a.uri,
            source: 'audio_files',
          })),
          ...(msg.files || []).map((f) => ({ uri: f.uri, source: 'files' })),
          ...(msg.gifs || []).map((g) => ({ uri: g.uri, source: 'gifs' })),
          ...(msg.media || []).map((m) => ({ uri: m.uri, source: 'media' })),
        ];

        if (
          allMediaItems.some(
            (item) =>
              item.uri === mediaItem.uri && item.source === mediaItem.source
          )
        ) {
          targetMessageIndex = i;
          break;
        }
      }
    }

    if (targetMessageIndex === -1) return;

    // Convert message index to group index
    const sortedMessages = currentMessage.messages
      .slice()
      .sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    const msgInSorted = sortedMessages[targetMessageIndex];

    let targetGroup = 0;
    for (let gi = 0; gi < groupedMessages.length; gi++) {
      const group = groupedMessages[gi];
      if (
        group.some(
          (m) =>
            m.timestamp_ms === msgInSorted.timestamp_ms &&
            m.sender_name === msgInSorted.sender_name
        )
      ) {
        targetGroup = gi;
        break;
      }
    }

    // Scroll directly to absolute group index
    messageGroupRef.current?.scrollToIndex({
      index: Math.max(0, targetGroup),
      align: 'center',
    });
    setSelectedMediaIndex(null);
  };

  // Scroll to search result when index changes
  useEffect(() => {
    if (!messageSearch.trim() || !searchResults || searchResults.length === 0)
      return;

    const r =
      searchResults[Math.min(messageSearchIndex, searchResults.length - 1)];
    if (!r) return;

    const targetGroup = r.groupIndex;

    // Scroll directly to absolute group index
    messageGroupRef.current?.scrollToIndex({
      index: Math.max(0, targetGroup),
      align: 'center',
    });
  }, [
    messageSearchIndex,
    messageSearch,
    searchResults,
    displayGroups,
  ]);

  const serverChats = data ?? [];
  const isBootLoading = archiveLoading || (archiveMode === 'server' && !data);

  // Show loading screen while detecting archive mode or loading server data.
  if (isBootLoading) {
    return (
      <div className='relative flex h-full w-full items-center justify-center'>
        <LoadingBar className='absolute top-0 left-0 h-1 w-full rounded-none' />
        <div className='flex w-full max-w-sm flex-col items-center gap-4 px-6'>
          <LoadingBar className='h-1 w-40' />
        </div>
      </div>
    );
  }

  if (archiveMode === 'server' && !data) {
    return (
      <div className='flex h-full w-full items-center justify-center'>
        <div className='text-center'>
          <div className='mb-4 text-lg font-semibold'>
            Loading mounted archive...
          </div>
          <div className='animate-spin'>↻</div>
        </div>
      </div>
    );
  }

  if (archiveMode === 'server' && serverChats.length === 0) {
    return (
      <div className='flex h-full w-full items-center justify-center px-6 text-center'>
        <div>
          <div className='mb-2 text-lg font-semibold'>
            No chats found in the mounted archive.
          </div>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            Check that /home/admh3/ffs/messages contains a Messenger export
            with an inbox folder.
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='flex h-full w-full items-center justify-center px-6 text-center'>
        <div>
          <div className='mb-2 text-lg font-semibold'>
            No archive loaded yet.
          </div>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            In Docker, make sure /home/admh3/ffs/messages is mounted and
            contains a Messenger export with an inbox folder.
          </div>
        </div>
      </div>
    );
  }

  return (
      <div
        className='flex h-full flex-col lg:flex-row'
        style={{
          paddingTop: windowControlsOverlayRect?.height ?? 0,
        }}
      >
        {windowControlsOverlayEnable && (
          <div
            className='fixed z-50 flex items-center justify-center'
            style={
              {
                width: windowControlsOverlayRect?.width || 0,
                height: windowControlsOverlayRect?.height || 0,
                top: windowControlsOverlayRect?.top || 0,
                left: windowControlsOverlayRect?.left || 0,
                WebkitAppRegion: 'drag',
              } as any
            }
          >
            <div className='w-full px-4' style={{ maxWidth: searchbarWidth }}>
              <SearchInput
                className='rounded-sm py-0.5 px-4'
                style={
                  {
                    WebkitAppRegion: 'no-drag',
                  } as any
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search for user...'
              />
            </div>
          </div>
        )}

        {/* Sidebar */}
        <div
          className={cx(
            'fixed left-0 top-0 z-40 h-full overflow-hidden border-r border-solid bg-white dark:border-gray-600 dark:bg-gray-900 lg:static lg:w-auto lg:max-w-[350px]',
            'hidden lg:flex',
            {
              'flex w-full max-w-[350px]': sidebarOpen,
            },
            'h-full max-h-full flex-col transition-all'
          )}
          style={{
            maxWidth: isDesktop ? '350px' : (sidebarOpen ? '350px' : '0px'),
          }}
        >
          <div
            className={cx(
              'flex flex-col items-start justify-center border-b border-solid px-4 py-4 dark:border-gray-600',
              {
                'border-t': windowControlsOverlayEnable,
              }
            )}
          >
            <div className='flex w-full items-center justify-between'>
              <h3 className='select-none text-lg font-semibold'>
                {chatTitle ? `${chatTitle}'s chat history` : 'Chat history'}
              </h3>

              <div className='flex gap-2'>
                <button
                  className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                  onClick={toggleTheme}
                  title='Toggle Theme'
                >
                  {dark ? <SunIcon width={18} /> : <MoonIcon width={18} />}
                </button>

                <button
                  className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                  title='Start Over'
                  onClick={() => {
                    setDirectory(null);
                    setInboxDir(null);
                    setFolderName(null);
                  }}
                >
                  <RefreshIcon width={18} />
                </button>
              </div>
            </div>

            {!windowControlsOverlayEnable && (
              <>
                <div className='block h-4 w-full' />

                <SearchInput
                  className='rounded-lg py-2 px-4'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Search for user...'
                />
              </>
            )}
          </div>

          {chats.length > 0 && (
            <Virtuoso
              className='h-full overflow-y-auto overflow-x-hidden'
              totalCount={chats.length}
              atBottomThreshold={20}
              itemContent={(index) => {
                const chat = chats[index];
                return (
                  <div
                    className='max-w-full cursor-default px-1 py-1.5'
                    key={chat.dirName}
                  >
                    <div
                      className={cx(
                        'flex items-center gap-2 rounded-lg py-3 px-5 hover:bg-gray-100 hover:dark:bg-gray-600',
                        {
                          'bg-gray-100 dark:bg-gray-600':
                            folderName === chat.dirName,
                        }
                      )}
                      onClick={() => {
                        setFolderName(chat.dirName);
                        if (sidebarOpen) {
                          toggleSidebar();
                        }
                      }}
                    >
                      <ChatAvatar
                        chat={chat}
                        sizeClass='h-9 w-9 flex-none'
                        fallbackTextClassName='text-xl'
                      />

                      <div className='flex max-w-full flex-col'>
                        <span className='mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap'>
                          {decodeString(chat.title)}
                        </span>
                        <small className='max-w-full overflow-hidden text-ellipsis text-gray-400'>
                          {chat.dirName}
                        </small>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}

          {chats.length === 0 && (
            <div className='flex h-full w-full select-none justify-center'>
              <div className='pt-6 text-gray-600 dark:text-gray-500'>
                No results
              </div>
            </div>
          )}
        </div>

        {/* Message boxes */}
        <div className='flex flex-1 flex-col'>
          <div
            className={cx(
              'flex w-full items-center justify-between border-b py-4 px-4 dark:border-gray-600',
              {
                'border-t': windowControlsOverlayEnable,
              }
            )}
          >
            {/* Hamburger menu for mobile */}
            <button
              onClick={toggleSidebar}
              className='rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600 lg:hidden'
              title='Toggle sidebar'
            >
              {sidebarOpen ? <XIcon width={20} /> : <MenuIcon width={20} />}
            </button>

            <div className='flex flex-1 items-center gap-2'>
              {selectedChat && (
                <ChatAvatar
                  chat={selectedChat}
                  sizeClass='h-10 w-10 flex-none'
                  fallbackTextClassName='text-sm'
                />
              )}

              <h3 className='select-none truncate text-lg font-semibold'>
                {currentMessage
                  ? decodeString(currentMessage.title)
                  : 'Please select chat to view'}
              </h3>

              {messageSearch && searchResults.length > 0 && (
                <span className='text-sm text-gray-500'>
                  {Math.min(messageSearchIndex + 1, searchResults.length)} /{' '}
                  {searchResults.length}
                </span>
              )}
              {messageSearch && searchResults.length === 0 && (
                <span className='text-sm text-gray-500'>No results</span>
              )}
            </div>

            <div className='flex gap-2'>
              <button
                className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                onClick={() => {
                  try {
                    toggleInfoPanel();
                    // eslint-disable-next-line no-empty
                  } catch {}
                }}
                title='Info'
              >
                <InformationCircleIcon width={18} />
              </button>

              <button
                className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                onClick={() => {
                  if (!currentMessage || groupedMessages.length === 0) return;
                  messageGroupRef.current?.scrollToIndex({
                    index: 0,
                    align: 'start',
                  });
                }}
                title='Jump to first message'
              >
                ↑ First
              </button>

              <button
                className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                onClick={() => {
                  if (!currentMessage || groupedMessages.length === 0) return;
                  messageGroupRef.current?.scrollToIndex({
                    index: Math.max(0, groupedMessages.length - 1),
                    align: 'end',
                  });
                }}
                title='Jump to latest message'
              >
                Latest ↓
              </button>

              <button
                className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                onClick={() => {
                  if (!currentMessage) return;

                  const input = window.prompt(
                    'Jump to date (YYYY-MM-DD or full ISO), e.g. 2020-05-01'
                  );
                  if (!input) return;
                  const ts = new Date(input).getTime();
                  if (isNaN(ts)) {
                    window.alert('Invalid date');
                    return;
                  }

                  // Find first message index with timestamp >= ts
                  const messages = currentMessage.messages
                    .slice()
                    .sort((a, b) => a.timestamp_ms - b.timestamp_ms);
                  let msgIndex = messages.findIndex(
                    (m) => (m.timestamp_ms || 0) >= ts
                  );
                  if (msgIndex === -1) {
                    msgIndex = messages.length - 1;
                  }

                  // Map message index to groupedMessages group index
                  let cum = 0;
                  let targetGroup = 0;
                  for (let gi = 0; gi < groupedMessages.length; gi++) {
                    const group = groupedMessages[gi];
                    if (cum + group.length > msgIndex) {
                      targetGroup = gi;
                      break;
                    }
                    cum += group.length;
                  }

                  messageGroupRef.current?.scrollToIndex({
                    index: targetGroup,
                    align: 'center',
                  });
                }}
                title='Jump to date'
              >
                📅 Date
              </button>
            </div>
          </div>

          {/* Message search bar */}
          {currentMessage && (
            <div className='flex items-center gap-2 border-b py-3 px-4 dark:border-gray-600'>
              <SearchInput
                className='flex-1 rounded-lg py-2 px-3'
                value={messageSearch}
                onChange={(e) => {
                  setMessageSearch(e.target.value);
                  setMessageSearchIndex(0);
                }}
                placeholder='Search messages...'
              />

              {messageSearch && searchResults.length > 0 && (
                <>
                  <button
                    className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                    onClick={() => {
                      setMessageSearchIndex(
                        (messageSearchIndex - 1 + searchResults.length) %
                          searchResults.length
                      );
                    }}
                    title='Previous result'
                  >
                    ↑
                  </button>
                  <button
                    className='rounded-full border-none p-2 hover:bg-gray-100 hover:dark:bg-gray-600'
                    onClick={() => {
                      setMessageSearchIndex(
                        (messageSearchIndex + 1) % searchResults.length
                      );
                    }}
                    title='Next result'
                  >
                    ↓
                  </button>
                </>
              )}

              {messageSearch && (
                <button
                  className='rounded px-2 py-1 text-sm ring-1 hover:bg-gray-100 hover:dark:bg-gray-600'
                  onClick={() => {
                    setMessageSearch('');
                    setMessageSearchIndex(0);
                  }}
                  title='Clear search'
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className='relative flex w-full flex-1 flex-col'>
            <Virtuoso
              className='flex w-full flex-1 flex-col gap-5 overflow-hidden overflow-y-auto break-all'
              ref={messageGroupRef}
              totalCount={displayGroups.length}
              atBottomThreshold={40}
              rangeChanged={(range) => {
                scrollPositionStore.set(folderName!, range.endIndex);
              }}
              itemContent={(groupIdx) => {
                const messages = displayGroups[groupIdx];
                const absoluteGroupIndex = groupIdx;

                const sectionSenderName = decodeString(messages[0].sender_name);
                const color = randomColor({
                  seed: sectionSenderName,
                  luminosity: theme,
                });
                const activePerspectiveName = perspectiveName
                  ? decodeString(perspectiveName)
                  : myName;
                const isMe = sectionSenderName === activePerspectiveName;

                return (
                  <div
                    className={cx('flex gap-2 px-4', {
                      'flex-row-reverse': isMe,
                      'pt-4': groupIdx === 0,
                      'pb-4': absoluteGroupIndex === groupedMessages.length - 1,
                    })}
                    key={absoluteGroupIndex}
                  >
                    {/* Avatar */}
                    {!isMe && (
                      <div className='flex flex-col items-center justify-end'>
                        <div
                          style={{
                            backgroundColor: color,
                          }}
                          className='h-8 w-8 rounded-full'
                        />
                      </div>
                    )}

                    {/* Messages */}
                    <div
                      className='item flex flex-col justify-between gap-0.5'
                      style={{
                        maxWidth: '65%',
                      }}
                    >
                      {!isMe && (
                        <small className='select-none pl-2 text-gray-400'>
                          {sectionSenderName}
                        </small>
                      )}

                      {messages.map((message, i) => {
                        const isFirst = i === 0;
                        const isLast = i === messages.length - 1;

                        return (
                          <MessageComponent
                            rootDir={selectedChat?.dirHandle ?? directory ?? undefined}
                            message={message}
                            key={`message_${message.sender_name}_${absoluteGroupIndex}_${i}`}
                            isFirst={isFirst}
                            isLast={isLast}
                            isMe={isMe}
                            highlightQuery={
                              messageSearch.trim() ? messageSearch : undefined
                            }
                            folderName={folderName ?? undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Info Panel */}
        {infoPanelOpen && currentMessage && (
          <>
            {/* Mobile overlay */}
            <div
              className='fixed inset-0 z-30 bg-black/50 lg:hidden'
              onClick={toggleInfoPanel}
            />
            {/* Panel */}
            <div
              className={cx(
                'lg:max-h-none fixed bottom-0 left-0 right-0 z-40 flex max-h-[80vh] flex-col overflow-y-auto rounded-t-lg border-t bg-white py-4 px-4 dark:border-gray-600 dark:bg-gray-900 lg:static lg:h-full lg:w-auto lg:rounded-none lg:rounded-t-none lg:border-l lg:border-t-0',
                {
                  'border-t': windowControlsOverlayEnable,
                }
              )}
              style={{ maxWidth: sidebarOpen ? 350 : 350 }}
            >
              <div className='mb-4 flex items-center justify-between'>
                <h3 className='flex-1 select-none text-center text-lg font-semibold'>
                  {decodeString(currentMessage.title)}
                </h3>
                <button
                  onClick={toggleInfoPanel}
                  className='rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden'
                  title='Close'
                >
                  <XIcon width={20} />
                </button>
              </div>

              <Collapsible
                title='Chat Members'
                containerClassName='flex flex-col gap-4 py-4 px-5'
                isExpanded={chatMembersInfoExpanded}
                onToggle={toggleChatMembersInfo}
              >
                <div className='flex flex-col gap-2'>
                  <label className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                    Perspective
                  </label>

                  <select
                    value={perspectiveName ?? ''}
                    onChange={(event) => {
                      setPerspectiveName(event.target.value || null);
                    }}
                    className='rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                  >
                    <option value=''>Archive default</option>
                    {currentMessage.participants.map((part) => (
                      <option key={part.name} value={part.name}>
                        {decodeString(part.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {currentMessage.participants.map((part) => {
                  const color = randomColor({
                    seed: part.name,
                    luminosity: theme,
                  });

                  return (
                    <div className='flex gap-2' key={part.name}>
                      <div
                        style={{
                          backgroundColor: color,
                        }}
                        className='h-6 w-6 rounded-full'
                      />

                      <span className='text-base'>
                        {decodeString(part.name)}
                      </span>
                    </div>
                  );
                })}
              </Collapsible>

              {chatStatistic && (
                <Collapsible
                  title='Chat Information'
                  containerClassName='flex flex-col gap-4 py-4 px-5'
                  isExpanded={chatInfoExpanded}
                  onToggle={toggleChatInfo}
                >
                  <div className='flex justify-between'>
                    <span className='text-base font-medium'>
                      Messages Count
                    </span>

                    <span className='text-right text-base text-gray-500'>
                      {currentMessage.messages.length}
                    </span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-base font-medium'>Members Count</span>

                    <span className='text-base text-gray-500'>
                      {currentMessage.participants.length}
                    </span>
                  </div>

                  <div className='flex justify-between'>
                    <span className='text-base font-medium'>Created At</span>

                    <span className='text-right text-base text-gray-500'>
                      {new Date(chatStatistic.createdAt).toLocaleString()}
                    </span>
                  </div>
                </Collapsible>
              )}

              {chatStatistic && (
                <Collapsible
                  title='Messages Count'
                  isExpanded={messageCountExpanded}
                  onToggle={toggleMessageCount}
                  containerClassName='flex flex-col gap-4 py-4 px-5'
                >
                  {(() => {
                    const sortedEntries = Object.entries(
                      chatStatistic.countInfo
                    ).sort(([, aCount], [, bCount]) => bCount - aCount);
                    const TOP_N = 200;

                    if (!showAllCounts) {
                      return (
                        <>
                          {sortedEntries
                            .slice(0, TOP_N)
                            .map(([senderName, count]) => (
                              <div
                                key={senderName}
                                className='flex justify-between'
                              >
                                <span className='text-base'>
                                  {decodeString(senderName)}
                                </span>

                                <span className='ml-2 text-base text-gray-500'>
                                  (
                                  {(
                                    (count / currentMessage.messages.length) *
                                    100
                                  ).toFixed(1)}
                                  % ) {count}
                                </span>
                              </div>
                            ))}

                          {sortedEntries.length > TOP_N && (
                            <div className='flex justify-center'>
                              <button
                                className='rounded px-3 py-1 ring-1'
                                onClick={() => setShowAllCounts(true)}
                              >
                                Show all ({sortedEntries.length})
                              </button>
                            </div>
                          )}

                          <div className='flex justify-between'>
                            <span className='text-base font-medium'>Total</span>

                            <span className='ml-2 text-base text-gray-500'>
                              {currentMessage.messages.length}
                            </span>
                          </div>
                        </>
                      );
                    }

                    // showAllCounts -> render virtualized list
                    const entriesArray = sortedEntries;
                    return (
                      <>
                        <div className='h-64'>
                          <Virtuoso
                            totalCount={entriesArray.length}
                            itemContent={(idx) => {
                              const [senderName, count] = entriesArray[idx];
                              return (
                                <div
                                  className='flex justify-between px-2'
                                  key={senderName}
                                >
                                  <span className='text-base'>
                                    {decodeString(senderName)}
                                  </span>
                                  <span className='ml-2 text-base text-gray-500'>
                                    (
                                    {(
                                      (count / currentMessage.messages.length) *
                                      100
                                    ).toFixed(1)}
                                    % ) {count}
                                  </span>
                                </div>
                              );
                            }}
                          />
                        </div>

                        <div className='mt-2 flex justify-center'>
                          <button
                            className='rounded px-3 py-1 ring-1'
                            onClick={() => setShowAllCounts(false)}
                          >
                            Collapse
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </Collapsible>
              )}

              {mediaItems && mediaItems.length > 0 && (
                <Collapsible
                  title={`📷 Media (${mediaItems.length})`}
                  isExpanded={mediaExpanded}
                  onToggle={toggleMedia}
                  containerClassName='flex flex-col gap-4 py-4 px-5'
                >
                  {/* Tabs */}
                  {(() => {
                    const ITEMS_PER_TAB = 300;
                    const totalTabs = Math.ceil(
                      mediaItems.length / ITEMS_PER_TAB
                    );
                    const startIdx = mediaTabIndex * ITEMS_PER_TAB;
                    const endIdx = Math.min(
                      startIdx + ITEMS_PER_TAB,
                      mediaItems.length
                    );
                    const tabItems = mediaItems.slice(startIdx, endIdx);

                    return (
                      <>
                        {totalTabs > 1 && (
                          <div className='flex gap-2 overflow-x-auto pb-2'>
                            {Array.from({ length: totalTabs }).map(
                              (_, tabIdx) => (
                                <button
                                  key={tabIdx}
                                  onClick={() => setMediaTabIndex(tabIdx)}
                                  className={`whitespace-nowrap rounded px-3 py-1 text-sm transition ${
                                    mediaTabIndex === tabIdx
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {tabIdx * ITEMS_PER_TAB + 1}-
                                  {Math.min(
                                    (tabIdx + 1) * ITEMS_PER_TAB,
                                    mediaItems.length
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {/* Grid */}
                        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3'>
                          {tabItems.map((item, localIdx) => {
                            const globalIdx = startIdx + localIdx;
                            const isImage = [
                              'photos',
                              'gifs',
                              'media',
                            ].includes(item.source);
                            const isVideo = ['videos'].includes(item.source);
                            const isAudio = ['audio', 'audio_files'].includes(
                              item.source
                            );

                            if (selectedChat?.dirHandle || folderName) {
                              return (
                                <MediaThumbnail
                                  key={`${item.timestamp_ms}_${globalIdx}`}
                                  item={item}
                                  rootDir={selectedChat?.dirHandle ?? undefined}
                                  isVideo={isVideo}
                                  isAudio={isAudio}
                                  onClick={() =>
                                    setSelectedMediaIndex(globalIdx)
                                  }
                                  folderName={folderName ?? undefined}
                                />
                              );
                            }

                            return null;
                          })}
                        </div>

                        {/* Info */}
                        <div className='text-center text-sm text-gray-500'>
                          Showing {startIdx + 1}-{endIdx} of {mediaItems.length}{' '}
                          items
                        </div>
                      </>
                    );
                  })()}
                </Collapsible>
              )}
            </div>
          </>
        )}

        {/* Media Viewer Modal */}
        {selectedMediaIndex !== null &&
          selectedChat?.dirHandle &&
          mediaItems.length > 0 && (
            <MediaViewer
              mediaItems={mediaItems}
              initialIndex={selectedMediaIndex}
              rootDir={selectedChat.dirHandle}
              onClose={() => setSelectedMediaIndex(null)}
              onJumpToMessage={jumpToMediaMessage}
              folderName={folderName ?? undefined}
            />
          )}
      </div>
    );
}
