'use client';

import { useState } from 'react';

interface AttemptNotesProps {
  logId: string;
  spId: string;
  attemptIndex: number;
  initialNote?: string;
}

export default function AttemptNotes({
  logId,
  spId,
  attemptIndex,
  initialNote = '',
}: AttemptNotesProps) {
  const [note, setNote] = useState<string>(initialNote);
  const [savedNote, setSavedNote] = useState<string>(initialNote);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTextarea, setShowTextarea] = useState<boolean>(false);

  const handleSave = async () => {
    if (!note.trim() && !savedNote) {
      setShowTextarea(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/attempt-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, spId, attemptIndex, note: note.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to save note');
      }

      setSavedNote(note.trim());
      setShowTextarea(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNote(savedNote);
    setShowTextarea(false);
    setError(null);
  };

  const handleEdit = () => {
    setNote(savedNote);
    setShowTextarea(true);
  };

  return (
    <div className="mt-1 pl-2">
      {savedNote && !showTextarea && (
        <div className="flex items-start gap-2 mb-1">
          <span className="text-xs text-muted-foreground text-gray-400 italic flex-1">
            📝 {savedNote}
          </span>
          <button
            onClick={handleEdit}
            className="text-xs text-gray-500 hover:text-gray-300 underline shrink-0"
          >
            Edit
          </button>
        </div>
      )}

      {!showTextarea && !savedNote && (
        <button
          onClick={() => setShowTextarea(true)}
          className="text-xs text-gray-500 hover:text-gray-400 underline"
        >
          + Add note
        </button>
      )}

      {showTextarea && (
        <div className="flex flex-col gap-1">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='e.g. "Fixed PROJECT_ID unused var manually"'
            rows={2}
            className="w-full text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 resize-none"
          />
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-2 py-1 rounded transition-colors"
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}