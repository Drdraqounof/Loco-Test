import { useEffect, useState } from 'react';
import type { AttachmentContextItem } from '@/lib/attachmentContext';

interface ElectronAttachmentItem extends AttachmentContextItem {
  audioBase64?: string;
}

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
  attachments: {
    openFiles: () => Promise<ElectronAttachmentItem[]>;
    openFolder: () => Promise<ElectronAttachmentItem[]>;
  };
  tts: {
    synthesize: (text: string, voice: string) => Promise<{ audioBase64: string; mimeType: string }>;
    status: (voice: string) => Promise<{ available: boolean; reason?: string | null; executable?: string; model?: string }>;
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
    attachments: {
      openFiles: async () => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.attachments.openFiles();
      },
      openFolder: async () => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.attachments.openFolder();
      },
    },
    tts: {
      synthesize: async (text: string, voice: string) => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.tts.synthesize(text, voice);
      },
      status: async (voice: string) => {
        if (!window.electronAPI) throw new Error('Electron API not available');
        return window.electronAPI.tts.status(voice);
      },
    },
    platform: typeof window !== 'undefined' && window.electronAPI ? window.electronAPI.platform : process.platform,
  };
}
