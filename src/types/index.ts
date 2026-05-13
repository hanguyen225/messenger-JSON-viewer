export type Chat = {
  name: string;
  dirName: string;
  lastSent: number;
  title: string;
  image?: string;
  dirHandle?: FileSystemDirectoryHandle | null;
};

export enum MessageType {
  Generic = 'Generic',
  Unsubscribe = 'Unsubscribe',
  Subscribe = 'Subscribe',
  Call = 'Call',
  Share = 'Share',
}

export type Message = (
  | {
    type: MessageType.Unsubscribe | MessageType.Unsubscribe;
    users: {
      name: string;
    }[];
  }
  | {
    type: MessageType.Call;
    call_duration: number;
  }
  | {
    type: MessageType.Share;
    share?: {
      link: string;
    };
  }
  | {
    type: MessageType.Generic;
  }
) & {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  share?: {
    link: string;
  };
  photos?: {
    uri: string;
    creation_timestamp: number;
  }[];
  videos?: {
    uri: string;
    creation_timestamp?: number;
  }[];
  audio?: {
    uri: string;
    creation_timestamp?: number;
  }[];
  audio_files?: {
    uri: string;
    creation_timestamp?: number;
  }[];
  files?: {
    uri: string;
    name?: string;
    creation_timestamp?: number;
  }[];
  gifs?: {
    uri: string;
    creation_timestamp?: number;
  }[];
  media?: {
    uri: string;
    creation_timestamp?: number;
  }[];
  sticker?: {
    uri: string;
  };
  is_unsent: boolean;
  reactions?: {
    reaction: string;
    actor: string;
  }[];
};

export type MessageData = {
  messages: Message[];
  participants: {
    name: string;
  }[];
  title: string;
  image?: {
    uri: string;
    creation_timestamp?: number;
  };
  is_still_participant: boolean;
  // TODO:
  thread_type: string;
  thread_path: string;
};
