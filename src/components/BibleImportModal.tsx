import React, { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, FileCode2, Upload, X } from 'lucide-react';
import type { BibleTranslation } from '../types/models';
import {
  parseBibleCSV,
  parseBibleJSON,
  parseBibleXML,
  sanitizeBibleTranslation,
  type BibleImportPreview,
} from '../utils/bibleEngine';

interface BibleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTranslations: BibleTranslation[];
  onConfirmImport: (translation: BibleTranslation) => void;
}

type BibleImportFormat = 'xml' | 'json' | 'csv';

export const BibleImportModal: React.FC<BibleImportModalProps> = ({
  isOpen,
  onClose,
  existingTranslations,
  onConfirmImport,
}) => {
  const [format, setFormat] = useState<BibleImportFormat>('xml');
  const [displayLabel, setDisplayLabel] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customAbbr, setCustomAbbr] = useState<string>('');
  const [customLanguage, setCustomLanguage] = useState<string>('English');
  const [replaceExistingId, setReplaceExistingId] = useState<string>('');

  const preview: BibleImportPreview | null = useMemo(() => {
    if (!rawContent.trim()) return null;
    const baseName = displayLabel || 'Imported Bible';
    if (format === 'xml') return parseBibleXML(rawContent, baseName);
    if (format === 'json') return parseBibleJSON(rawContent, baseName);
    return parseBibleCSV(rawContent, baseName);
  }, [rawContent, format, displayLabel]);

  if (!isOpen) return null;

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    // Only use base name for display; never save file paths or re-read from disk
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setDisplayLabel(baseName);
    const ext = file.name.split('.').pop()?.toLowerCase();
    let nextFormat: BibleImportFormat = format;
    if (ext === 'xml') nextFormat = 'xml';
    else if (ext === 'json') nextFormat = 'json';
    else if (ext === 'csv') nextFormat = 'csv';
    setFormat(nextFormat);

    const text = await file.text();
    setRawContent(text);

    const parsed =
      nextFormat === 'xml'
        ? parseBibleXML(text, baseName)
        : nextFormat === 'json'
        ? parseBibleJSON(text, baseName)
        : parseBibleCSV(text, baseName);

    setCustomName(parsed.translation.name);
    setCustomAbbr(parsed.translation.abbreviation);
    setCustomLanguage(parsed.translation.language || 'English');
  };

  const canConfirm = Boolean(preview && preview.stats.verseCount > 0 && customAbbr.trim());

  const handleConfirm = () => {
    if (!preview || !canConfirm) return;
    const finalTranslation = sanitizeBibleTranslation({
      ...preview.translation,
      id: replaceExistingId || preview.translation.id,
      name: customName.trim() || preview.translation.name,
      abbreviation: (customAbbr.trim() || preview.translation.abbreviation).toUpperCase(),
      language: customLanguage.trim() || preview.translation.language,
      isUserImported: true,
      importedAt: new Date().toISOString(),
    });
    onConfirmImport(finalTranslation);
    setRawContent('');
    setDisplayLabel('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bible-import-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-[#171b22] border border-[#2c323d] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c323d] bg-[#20242c]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <h2 id="bible-import-title" className="text-xs font-semibold text-white">
              Import Bible Translation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#252a33] transition-colors"
            aria-label="Close import modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Supported Format
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#11141a] rounded-lg border border-[#2c323d]">
                {(['xml', 'json', 'csv'] as BibleImportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`py-1 px-2.5 rounded text-[11px] font-medium uppercase transition-colors ${
                      format === fmt
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-[#20242c]'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Extract From File (Stored In-App Only)
              </label>
              <label className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate">{displayLabel || 'Choose XML, JSON, or CSV file'}</span>
                <input
                  type="file"
                  accept=".xml,.json,.csv,.txt"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                File Contents ({format.toUpperCase()})
              </label>
              <span className="text-[10px] text-slate-500">
                Extracted once into app memory — no file path is saved
              </span>
            </div>
            <textarea
              value={rawContent}
              onChange={(e) => {
                const next = e.target.value;
                setRawContent(next);
                if (!customName && next.trim()) {
                  const p =
                    format === 'xml'
                      ? parseBibleXML(next)
                      : format === 'json'
                      ? parseBibleJSON(next)
                      : parseBibleCSV(next);
                  setCustomName(p.translation.name);
                  setCustomAbbr(p.translation.abbreviation);
                  setCustomLanguage(p.translation.language);
                }
              }}
              rows={5}
              placeholder={`Paste or upload ${format.toUpperCase()} Bible data...`}
              className="w-full rounded-lg bg-[#11141a] border border-[#2c323d] p-2.5 text-[11px] font-mono-tabular text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Translation Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., New Living Translation"
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Abbreviation
              </label>
              <input
                type="text"
                value={customAbbr}
                onChange={(e) => setCustomAbbr(e.target.value.toUpperCase())}
                placeholder="e.g., NLT"
                maxLength={10}
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] font-mono-tabular text-white uppercase focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Language
              </label>
              <input
                type="text"
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                placeholder="English"
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {existingTranslations.length > 0 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Import Destination
              </label>
              <select
                value={replaceExistingId}
                onChange={(e) => setReplaceExistingId(e.target.value)}
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Add as new translation</option>
                {existingTranslations.map((t) => (
                  <option key={t.id} value={t.id}>
                    Replace {t.abbreviation} ({t.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {preview && (
            <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                  {preview.errors.length === 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Extracted Preview</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular">
                  {preview.stats.bookCount} Books · {preview.stats.chapterCount} Chapters ·{' '}
                  {preview.stats.verseCount} Verses
                </div>
              </div>

              {preview.errors.length > 0 && (
                <div className="rounded bg-red-950/40 border border-red-900/60 p-2 space-y-1">
                  {preview.errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="text-[11px] text-red-300">
                      • {err}
                    </div>
                  ))}
                </div>
              )}

              {preview.stats.verseCount > 0 && (
                <div className="text-[11px] text-slate-300">
                  First verse:{' '}
                  <span className="font-semibold text-white">
                    {preview.translation.books[0]?.name}{' '}
                    {preview.translation.books[0]?.chapters[0]?.number}:
                    {preview.translation.books[0]?.chapters[0]?.verses[0]?.number}
                  </span>{' '}
                  — “{preview.translation.books[0]?.chapters[0]?.verses[0]?.text}”
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#2c323d] bg-[#20242c]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-300 hover:text-white bg-[#252a33] hover:bg-[#2f3642] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};
