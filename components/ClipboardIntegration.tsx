'use client';

// In plain terms: this component handles copy-to-clipboard actions for the app.

import { useState } from 'react';
import { useElectron } from '@/tools/hooks/useElectron';

export default function ClipboardIntegration() {
  const { isElectron, clipboard } = useElectron();
  const [clipboardContent, setClipboardContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [copied, setCopied] = useState(false);

  const handleReadClipboard = async () => {
    try {
      const content = await clipboard.read();
      setClipboardContent(content);
      setEditedContent(content);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  const handleWriteClipboard = async () => {
    try {
      await clipboard.write(editedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to write clipboard:', error);
    }
  };

  if (!isElectron) {
    return (
      <div className="p-4 bg-blue-100 border border-blue-400 rounded">
        <p className="text-sm text-blue-700">
          💡 Clipboard features only work in Electron desktop app. Run <code>npm run electron:dev</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded bg-slate-50">
      <h3 className="font-semibold text-lg">Quick Paste & Edit</h3>
      
      <div className="space-y-2">
        <button
          onClick={handleReadClipboard}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          📋 Read Clipboard
        </button>
        <p className="text-sm text-gray-600">Paste what you have copied to check it</p>
      </div>

      {clipboardContent && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Your Content:</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-2 border rounded font-mono text-sm h-32"
              placeholder="Your clipboard content will appear here..."
            />
          </div>

          <button
            onClick={handleWriteClipboard}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {copied ? '✓ Copied!' : '📋 Copy Back to Clipboard'}
          </button>
        </>
      )}
    </div>
  );
}
