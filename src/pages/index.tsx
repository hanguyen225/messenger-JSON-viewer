import {
  InformationCircleIcon,
  MoonIcon,
  RefreshIcon,
  SunIcon,
} from '@heroicons/react/outline';
import cx from 'clsx';
import randomColor from 'randomcolor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useSWR from 'swr';

import useTheme from '@/lib/hooks/useTheme';
import useThemeColor from '@/lib/hooks/useThemeColor';
import useToggle from '@/lib/hooks/useToggle';
import useWindowOverlay from '@/lib/hooks/useWindowOverlay';
import { findInboxFolder } from '@/lib/utils/file';
import {
  decodeString,
  getMyselfName,
  loadChats,
  useAllMediaItems,
  useChatStatistics,
  useCurrentMessage,
  useGroupedMessages,
} from '@/lib/utils/message';

import Collapsible from '@/components/Collapsible';
import MediaThumbnail from '@/components/MediaThumbnail';
import MediaViewer from '@/components/MediaViewer';
import MessageComponent from '@/components/Message';
import OnboardingCarousel from '@/components/OnboardingCarousel';
import SearchInput from '@/components/SearchInput';

function StartScreen({ openDirPicker }: { openDirPicker: () => void }) {
  const contents = [
    <div
      key='step-1'
      className='flex w-full flex-col items-center justify-center'
    >
      <img src='/ios/100.png' alt='logo' width={100} height={100} />
      <h1 className='text-center text-2xl font-bold'>
        Welcome to Facebook Messenger exported JSON viewer
      </h1>
      <p className='mt-5'>Click next to continue</p>
    </div>,
    <div
      key='step-2'
      className='flex w-full flex-col items-center justify-center'
    >
      <img
        src='/images/step1.png'
        className='mb-5 w-full max-w-5xl'
        alt='step-1'
      />
      <h2 className='text-center text-xl font-bold'>
        Step 1: Export the messenger data as JSON from Facebook. Go to{' '}
        <a
          href='https://www.facebook.com/dyi'
          target='_blank'
          rel='noreferrer'
          className='underline'
        >
          Download Your Information
        </a>{' '}
        page.
      </h2>
    </div>,
    <div
      key='step-3'
      className='flex w-full flex-col items-center justify-center'
    >
      <img
        src='/images/step2.png'
        className='mb-5 w-full max-w-5xl'
        alt='step-2'
      />
      <h2 className='text-center text-xl font-bold'>
        Step 2: Make sure your folder looks like this.
      </h2>
    </div>,
    <div key='step-3'>
      <button
        className='rounded px-4 py-2 ring-1 hover:bg-blue-500 hover:text-white'
        onClick={openDirPicker}
      >
        Open Folder
      </button>
    </div>,
  ];

  return (
    <OnboardingCarousel className='flex h-full flex-col items-center justify-center overflow-hidden'>
      {contents}
    </OnboardingCarousel>
  );
}

const scrollPositionStore = new Map();

export default function HomePage() {
  const [directory, setDirectory] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [inboxDir, setInboxDir] = useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [search, setSearch] = useState('');
  const [infoPanelOpen, , toggleInfoPanel] = useToggle(false);
  const [chatMembersInfoExpanded, , toggleChatMembersInfo] = useToggle(false);
  const [messageCountExpanded, , toggleMessageCount] = useToggle(false);
  const [chatInfoExpanded, , toggleChatInfo] = useToggle(false);
  const [mediaExpanded, , toggleMedia] = useToggle(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null
  );

  const [folderName, setFolderName] = useState<string | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);
  const currentMessage = useCurrentMessage(folderName);
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
  const [visibleStart, setVisibleStart] = useState(0);
  const VISIBLE_CHUNK = 10000;

  useEffect(() => {
    // Reset search when changing chats
    setMessageSearch('');
    setMessageSearchIndex(0);

    const position = scrollPositionStore.get(folderName!);

    // Initialize visible window to last VISIBLE_CHUNK groups
    const start = Math.max(0, groupedMessages.length - VISIBLE_CHUNK);
    setVisibleStart(start);

    const targetIndex = position || groupedMessages.length - 1;

    // Scroll to index relative to visibleStart
    const relativeIndex = Math.max(0, targetIndex - start);

    messageGroupRef.current?.scrollToIndex({
      index: relativeIndex,
      align: 'end',
    });
  }, [folderName, groupedMessages]);

  const { dark, toggleTheme, theme } = useTheme();
  const [showAllCounts, setShowAllCounts] = useState(false);
  useThemeColor({
    dark: '#121212',
    light: '#ffffff',
  });

  const { data } = useSWR(
    () => inboxDir?.name && ['chats', inboxDir?.name],
    () => loadChats(inboxDir)
  );
  const { data: myName = null } = useSWR(
    () => (directory ? 'myName' : false),
    () => {
      return getMyselfName(directory!);
    }
  );

  const chats = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .sort((a, b) => b.lastSent - a.lastSent)
      .filter((c) => c.title.includes(search) || c.dirName.includes(search));
  }, [data, search]);

  const selectedChat = useMemo(() => {
    if (!folderName || !data) {
      return null;
    }

    return data.find((chat) => chat.dirName === folderName) ?? null;
  }, [data, folderName]);

  // Display window of grouped messages to avoid virtualization limits
  const displayGroups = useMemo(() => {
    if (!groupedMessages || groupedMessages.length === 0) return [];
    return groupedMessages.slice(visibleStart);
  }, [groupedMessages, visibleStart]);

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
    let cum = 0;
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
      cum += group.length;
    }

    // Adjust visible window if needed
    const windowStart = visibleStart;
    const windowEnd = visibleStart + displayGroups.length - 1;

    let desiredStart = windowStart;
    if (targetGroup < windowStart) {
      desiredStart = Math.max(0, targetGroup - Math.floor(VISIBLE_CHUNK / 2));
    } else if (targetGroup > windowEnd) {
      desiredStart = Math.max(0, targetGroup - Math.floor(VISIBLE_CHUNK / 2));
    }

    if (desiredStart !== visibleStart) {
      setVisibleStart(desiredStart);
      setTimeout(() => {
        const relative = targetGroup - desiredStart;
        messageGroupRef.current?.scrollToIndex({
          index: relative,
          align: 'center',
        });
        setSelectedMediaIndex(null);
      }, 50);
    } else {
      const relative = targetGroup - visibleStart;
      messageGroupRef.current?.scrollToIndex({
        index: relative,
        align: 'center',
      });
      setSelectedMediaIndex(null);
    }
  };

  // Scroll to search result when index changes
  useEffect(() => {
    if (!messageSearch.trim() || !searchResults || searchResults.length === 0)
      return;

    const r =
      searchResults[Math.min(messageSearchIndex, searchResults.length - 1)];
    if (!r) return;

    const targetGroup = r.groupIndex;

    // If target group is outside visible window, adjust visibleStart so it's visible
    const windowStart = visibleStart;
    const windowEnd = visibleStart + displayGroups.length - 1;

    let desiredStart = windowStart;
    if (targetGroup < windowStart) {
      desiredStart = Math.max(0, targetGroup - Math.floor(VISIBLE_CHUNK / 2));
    } else if (targetGroup > windowEnd) {
      desiredStart = Math.max(0, targetGroup - Math.floor(VISIBLE_CHUNK / 2));
    }

    if (desiredStart !== visibleStart) {
      setVisibleStart(desiredStart);
      // wait a tick for rendering then scroll
      setTimeout(() => {
        const relative = targetGroup - desiredStart;
        messageGroupRef.current?.scrollToIndex({
          index: relative,
          align: 'center',
        });
      }, 50);
    } else {
      const relative = targetGroup - visibleStart;
      messageGroupRef.current?.scrollToIndex({
        index: relative,
        align: 'center',
      });
    }
  }, [
    messageSearchIndex,
    messageSearch,
    searchResults,
    visibleStart,
    displayGroups,
  ]);

  const openDirPicker = async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker();

      const inbox = await findInboxFolder(directoryHandle);

      if (inbox) {
        setInboxDir(inbox);
        setDirectory(directoryHandle);
      } else {
        window.alert('This is not a valid Messenger archive folder.');
      }
      // eslint-disable-next-line no-empty
    } catch {}
  };

  if (!data || data.length === 0) {
    return <StartScreen openDirPicker={openDirPicker} />;
  } else {
    return (
      <div
        className='flex h-full'
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
          className='flex h-full max-h-full w-full flex-col border-r border-solid dark:border-gray-600'
          style={{ maxWidth: 350 }}
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
                {myName}&#39;s chat history
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
                      }}
                    >
                      <div
                        className='flex h-9 w-9 select-none items-center justify-center rounded-full text-xl text-white'
                        style={{
                          minWidth: '2.25rem',
                          minHeight: '2.25rem',
                          backgroundColor: randomColor({
                            luminosity: 'dark',
                            seed: chat.dirName,
                          }),
                        }}
                      >
                        {chat.title[0]}
                      </div>

                      <div className='flex max-w-full flex-col'>
                        <span className='mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap'>
                          {chat.title}
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
            <div className='flex flex-1 items-center gap-2'>
              <h3 className='select-none text-lg font-semibold'>
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
                  } catch {}
                }}
                title='Info'
              >
                <InformationCircleIcon width={18} />
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
                Jump
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
            {visibleStart > 0 && (
              <div className='sticky top-0 z-10 flex w-full justify-center bg-white/70 py-2 dark:bg-slate-900/70'>
                <button
                  className='rounded px-3 py-1 ring-1'
                  onClick={() => {
                    // Load earlier chunk
                    setVisibleStart(Math.max(0, visibleStart - VISIBLE_CHUNK));
                    // small delay to allow items to render
                    setTimeout(() => {
                      messageGroupRef.current?.scrollToIndex({
                        index: 0,
                        align: 'start',
                      });
                    }, 50);
                  }}
                >
                  Load earlier messages
                </button>
              </div>
            )}

            <Virtuoso
              className='flex w-full flex-1 flex-col gap-5 overflow-hidden overflow-y-auto break-all'
              ref={messageGroupRef}
              totalCount={displayGroups.length}
              atBottomThreshold={40}
              rangeChanged={(range) => {
                if (range.endIndex && range.startIndex) {
                  // store absolute end index
                  scrollPositionStore.set(
                    folderName!,
                    visibleStart + range.endIndex
                  );
                }
              }}
              itemContent={(groupIdx) => {
                const messages = displayGroups[groupIdx];
                const absoluteGroupIndex = visibleStart + groupIdx;

                const sectionSenderName = decodeString(messages[0].sender_name);
                const color = randomColor({
                  seed: sectionSenderName,
                  luminosity: theme,
                });
                const isMe = sectionSenderName === myName;

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
                            rootDir={selectedChat?.dirHandle ?? directory!}
                            message={message}
                            key={`message_${message.sender_name}_${absoluteGroupIndex}_${i}`}
                            isFirst={isFirst}
                            isLast={isLast}
                            isMe={isMe}
                            highlightQuery={
                              messageSearch.trim() ? messageSearch : undefined
                            }
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
          <div
            className={cx(
              'flex h-full w-full flex-col overflow-y-auto border-l py-4 px-4 dark:border-gray-600',
              {
                'border-t': windowControlsOverlayEnable,
              }
            )}
            style={{ maxWidth: 350 }}
          >
            <h3 className='mb-4 select-none text-center text-lg font-semibold'>
              {decodeString(currentMessage.title)}
            </h3>

            <Collapsible
              title='Chat Members'
              containerClassName='flex flex-col gap-4 py-4 px-5'
              isExpanded={chatMembersInfoExpanded}
              onToggle={toggleChatMembersInfo}
            >
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

                    <span className='text-base'>{decodeString(part.name)}</span>
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
                  <span className='text-base font-medium'>Messages Count</span>

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
                <div className='grid grid-cols-3 gap-3'>
                  {mediaItems.slice(0, 300).map((item, idx) => {
                    const isImage = ['photos', 'gifs', 'media'].includes(
                      item.source
                    );
                    const isVideo = ['videos'].includes(item.source);
                    const isAudio = ['audio', 'audio_files'].includes(
                      item.source
                    );

                    if (selectedChat?.dirHandle) {
                      return (
                        <MediaThumbnail
                          key={`${item.timestamp_ms}_${idx}`}
                          item={item}
                          rootDir={selectedChat.dirHandle}
                          isVideo={isVideo}
                          isAudio={isAudio}
                          onClick={() => setSelectedMediaIndex(idx)}
                        />
                      );
                    }

                    return null;
                  })}
                </div>

                {mediaItems.length > 300 && (
                  <div className='text-center text-sm text-gray-500'>
                    Showing 300 of {mediaItems.length} items
                  </div>
                )}
              </Collapsible>
            )}
          </div>
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
            />
          )}
      </div>
    );
  }
}
