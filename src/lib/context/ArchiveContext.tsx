import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import { isServerArchiveAvailable } from '@/lib/utils/serverFile';

type FileMode = 'local' | 'server';

type ArchiveContextType = {
  mode: FileMode;
  isLoading: boolean;
};

const ArchiveContext = createContext<ArchiveContextType>({
  mode: 'local',
  isLoading: true,
});

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<FileMode>('local');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectMode = async () => {
      const serverAvailable = await isServerArchiveAvailable();
      setMode(serverAvailable ? 'server' : 'local');
      setIsLoading(false);
    };

    detectMode();
  }, []);

  return (
    <ArchiveContext.Provider value={{ mode, isLoading }}>
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchiveMode() {
  return useContext(ArchiveContext);
}
