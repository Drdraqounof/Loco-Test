import { useEffect, useState } from 'react';

interface ElectronAPI {
  clipboard: {
    read: () => Promise<string>;
    write: (text: string) => Promise<void>;
  };
  window: {
    toggle: () => Promise<void>;
  };
  file: {
    read: (filePath: string) => Promise<string>;
  };
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI);
  }, []);

  return {
    isElectron,
    clipboard: {
      read: async () => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.clipboard.read();
      },
      write: async (text: string) => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.clipboard.write(text);
      },
    },
    window: {
      toggle: async () => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.window.toggle();
      },
    },
    file: {
      read: async (filePath: string) => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.file.read(filePath);
      },
    },
    platform: typeof window !== 'undefined' && window.electronAPI ? window.electronAPI.platform : process.platform,
  };
}
