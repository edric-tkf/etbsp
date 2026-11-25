import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Cloud, GitMerge, Music2, X } from 'lucide-react';
import type { SongMergeConflict } from '../types/models';
import { songToRawText } from '../utils/songEngine';

export type ConflictChoice = 'local' | 'remote';

interface SongbookConflictModalProps {
  conflicts: SongMergeConflict[];
  currentIndex: number;
  isSubmitting: boolean;
  onChooseCurrent: (choice: ConflictChoice) => void;
  onChooseAllRemaining: (choice: ConflictChoice) => void;
  onCancel: () => void;
}

export const SongbookConflictModal: React.FC<SongbookConflictModalProps> = ({
  conflicts,
  currentIndex,
  isSubmitting,
  onChooseCurrent,
  onChooseAllRemaining,
  onCancel,
}) => {
  const current = conflicts[currentIndex];
  if (!current) return null;

  const localLyrics = songToRawText(current.localSong);
  const remoteLyrics = current.remoteDoc.lyrics.trim() || '(Empty lyrics)';
  const remainingCount = conflicts.length - currentIndex;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-4xl max-h-[88vh] rounded-xl bg-[#171b22] border border-[#2c323d] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#252a33] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <GitMerge className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">
                  Resolve Lyric Difference: {current.title}
                </h2>
                <p className="text-xs text-slate-400">
                  Both apps have a song with this exact name, but the lyrics are different. Choose
                  which version to keep for both apps.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-1 rounded bg-[#20242c] border border-[#2c323d] text-xs font-mono-tabular text-slate-300">
                {currentIndex + 1} of {conflicts.length}
              </span>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancel}
                aria-label="Cancel merge"
                className="p-1 rounded hover:bg-[#252a33] text-slate-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="flex-1 min-h-0 p-4 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
            {/* Local ET BSP Version */}
            <div className="rounded-lg bg-[#11141a] border border-blue-500/40 flex flex-col min-h-[260px] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[#1b212d] border-b border-[#252a33] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                    <Music2 className="w-3.5 h-3.5 shrink-0" />
                    <span>ET BSP (This App)</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    Artists: {current.localSong.artist?.trim() || 'None'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onChooseCurrent('local')}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use ET BSP</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-mono-tabular leading-relaxed overflow-y-auto">
                {localLyrics || '(Empty lyrics)'}
              </pre>
            </div>

            {/* Remote Songbook Version */}
            <div className="rounded-lg bg-[#11141a] border border-emerald-500/40 flex flex-col min-h-[260px] overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[#182320] border-b border-[#252a33] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                    <span>Songbook (pnw-lyrics)</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    Artists: {current.remoteDoc.artists.trim() || 'None'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onChooseCurrent('remote')}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use Songbook</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-mono-tabular leading-relaxed overflow-y-auto">
                {remoteLyrics}
              </pre>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 border-t border-[#252a33] bg-[#141820] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded bg-[#252a33] hover:bg-[#303642] text-xs font-medium text-slate-200 disabled:opacity-50"
            >
              Cancel Merge
            </button>

            {remainingCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onChooseAllRemaining('local')}
                  className="px-3 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-xs font-medium text-blue-200 disabled:opacity-50"
                >
                  Use ET BSP for All ({remainingCount})
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onChooseAllRemaining('remote')}
                  className="px-3 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-xs font-medium text-emerald-200 disabled:opacity-50"
                >
                  Use Songbook for All ({remainingCount})
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
