import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Song, SongbookDocument, SongMergeConflict } from '../types/models';
import { getSongbookDb, SONGBOOK_COLLECTION } from '../firebase/firebaseClients';
import { parseSongTXT, songToRawText, sortSongsAlphabetically } from './songEngine';

export const DEFAULT_SONGBOOK_CLASSIFICATION = 'Worship';

export interface SongbookDocPayload {
  title: string;
  artists: string;
  lyrics: string;
}

export interface SongbookUpdateItem {
  docId: string;
  payload: SongbookDocPayload;
  classification?: string;
}

export function normalizeSongTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeLyricsForComparison(rawLyrics: string): string {
  const lines = String(rawLyrics ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd());

  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const collapsed: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (collapsed.length > 0 && collapsed[collapsed.length - 1] !== '') {
        collapsed.push('');
      }
    } else {
      collapsed.push(line.trim());
    }
  }
  return collapsed.join('\n');
}

export function computeSongContentHash(title: string, artists: string, lyrics: string): string {
  const input = `${normalizeSongTitleKey(title)}||${artists.trim()}||${normalizeLyricsForComparison(lyrics)}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sb-${(hash >>> 0).toString(16)}`;
}

export function songToSongbookPayload(song: Song): SongbookDocPayload {
  return {
    title: song.title.trim() || 'Untitled Song',
    artists: (song.artist || '').trim(),
    lyrics: songToRawText(song),
  };
}

export function normalizeArtistsString(raw: unknown): string {
  const parts = Array.isArray(raw)
    ? raw.map((item) => String(item ?? ''))
    : typeof raw === 'string'
    ? raw.split(',')
    : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(trimmed);
    }
  }
  return cleaned.join(', ');
}

export function mergeArtistsValues(localArtists: string, remoteArtists: string): string {
  const localClean = normalizeArtistsString(localArtists);
  const remoteClean = normalizeArtistsString(remoteArtists);
  if (!localClean) return remoteClean;
  if (!remoteClean) return localClean;
  if (localClean.toLowerCase() === remoteClean.toLowerCase()) return remoteClean;
  return normalizeArtistsString([...remoteClean.split(','), ...localClean.split(',')]);
}

export function parseSongbookDocToSong(remote: SongbookDocument, existingLocal?: Song): Song {
  const cleanTitle = remote.title.trim() || existingLocal?.title || 'Untitled Song';
  const cleanArtists = normalizeArtistsString(remote.artists);
  const rawLyrics = String(remote.lyrics ?? '').replace(/\r/g, '').trim();
  const now = new Date().toISOString();
  const hash = computeSongContentHash(cleanTitle, cleanArtists, rawLyrics);

  if (!rawLyrics) {
    return {
      id: existingLocal?.id || `song-${remote.id}`,
      title: cleanTitle,
      artist: cleanArtists,
      author: existingLocal?.author,
      language: existingLocal?.language || 'English',
      copyright: existingLocal?.copyright,
      rawText: '',
      sections: [],
      songbookDocId: remote.id,
      lastSyncedHash: hash,
      createdAt: existingLocal?.createdAt || now,
      updatedAt: now,
    };
  }

  const parsed = parseSongTXT(rawLyrics, {
    id: existingLocal?.id || `song-${remote.id}`,
    title: cleanTitle,
    artist: cleanArtists,
    author: existingLocal?.author,
    language: existingLocal?.language || 'English',
    createdAt: existingLocal?.createdAt || now,
    updatedAt: now,
  });

  return {
    ...parsed.song,
    artist: cleanArtists,
    songbookDocId: remote.id,
    lastSyncedHash: hash,
  };
}

export interface ReconcileSongbookOptions {
  mode: 'manual-merge' | 'auto-sync';
}

export interface ReconcileSongbookResult {
  mergedLocalSongs: Song[];
  toCreateInRemote: Array<{ localSongId: string; payload: SongbookDocPayload }>;
  toUpdateInRemote: SongbookUpdateItem[];
  conflicts: SongMergeConflict[];
  removedLocalIds: string[];
  addedFromRemoteCount: number;
}

export function reconcileSongbookMerge(
  localSongs: Song[],
  remoteDocs: SongbookDocument[],
  options: ReconcileSongbookOptions = { mode: 'manual-merge' }
): ReconcileSongbookResult {
  const matchedLocalIndices = new Set<number>();
  const matchedRemoteIndices = new Set<number>();
  const pairs: Array<{ localIdx: number; remoteIdx: number }> = [];

  // Pass 1: Match by existing songbookDocId link
  const remoteIndexById = new Map<string, number>();
  remoteDocs.forEach((docItem, idx) => remoteIndexById.set(docItem.id, idx));

  localSongs.forEach((localSong, localIdx) => {
    if (!localSong.songbookDocId) return;
    const remoteIdx = remoteIndexById.get(localSong.songbookDocId);
    if (remoteIdx !== undefined && !matchedRemoteIndices.has(remoteIdx)) {
      matchedLocalIndices.add(localIdx);
      matchedRemoteIndices.add(remoteIdx);
      pairs.push({ localIdx, remoteIdx });
    }
  });

  // Pass 2: Match remaining songs by exact normalized song name (preferring exact case match)
  for (let localIdx = 0; localIdx < localSongs.length; localIdx++) {
    if (matchedLocalIndices.has(localIdx)) continue;
    const localTitleTrim = localSongs[localIdx].title.trim();
    const localKey = normalizeSongTitleKey(localTitleTrim);
    if (!localKey) continue;

    let bestRemoteIdx = -1;
    for (let remoteIdx = 0; remoteIdx < remoteDocs.length; remoteIdx++) {
      if (matchedRemoteIndices.has(remoteIdx)) continue;
      const remoteTitleTrim = remoteDocs[remoteIdx].title.trim();
      if (normalizeSongTitleKey(remoteTitleTrim) !== localKey) continue;
      if (remoteTitleTrim === localTitleTrim) {
        bestRemoteIdx = remoteIdx;
        break;
      }
      if (bestRemoteIdx === -1) {
        bestRemoteIdx = remoteIdx;
      }
    }

    if (bestRemoteIdx !== -1) {
      matchedLocalIndices.add(localIdx);
      matchedRemoteIndices.add(bestRemoteIdx);
      pairs.push({ localIdx, remoteIdx: bestRemoteIdx });
    }
  }

  const nextLocalSongs: Song[] = [];
  const toCreateInRemote: Array<{ localSongId: string; payload: SongbookDocPayload }> = [];
  const toUpdateInRemote: SongbookUpdateItem[] = [];
  const conflicts: SongMergeConflict[] = [];
  const removedLocalIds: string[] = [];
  let addedFromRemoteCount = 0;

  // Process matched pairs
  for (const { localIdx, remoteIdx } of pairs) {
    const localSong = localSongs[localIdx];
    const remoteDoc = remoteDocs[remoteIdx];
    const missingRemoteClassification = !remoteDoc.classification?.trim();

    const localPayload = songToSongbookPayload(localSong);
    const normLocalLyrics = normalizeLyricsForComparison(localPayload.lyrics);
    const normRemoteLyrics = normalizeLyricsForComparison(remoteDoc.lyrics);
    const localArtists = normalizeArtistsString(localPayload.artists);
    const remoteArtists = normalizeArtistsString(remoteDoc.artists);

    const localHash = computeSongContentHash(localPayload.title, localArtists, localPayload.lyrics);
    const remoteHash = computeSongContentHash(remoteDoc.title, remoteArtists, remoteDoc.lyrics);

    // In auto-sync mode, honor single-side edits (whether title, artists, or lyrics changed)
    if (options.mode === 'auto-sync' && localSong.lastSyncedHash) {
      const localUnchanged = localHash === localSong.lastSyncedHash;
      const remoteUnchanged = remoteHash === localSong.lastSyncedHash;

      if (localUnchanged && !remoteUnchanged) {
        nextLocalSongs.push(parseSongbookDocToSong(remoteDoc, localSong));
        if (missingRemoteClassification) {
          toUpdateInRemote.push({
            docId: remoteDoc.id,
            payload: {
              title: remoteDoc.title.trim() || localPayload.title,
              artists: remoteArtists,
              lyrics: remoteDoc.lyrics,
            },
            classification: DEFAULT_SONGBOOK_CLASSIFICATION,
          });
        }
        continue;
      }
      if (!localUnchanged && remoteUnchanged) {
        const updatedSong: Song = {
          ...localSong,
          artist: localArtists,
          songbookDocId: remoteDoc.id,
          lastSyncedHash: localHash,
        };
        nextLocalSongs.push(updatedSong);
        toUpdateInRemote.push({
          docId: remoteDoc.id,
          payload: { ...localPayload, artists: localArtists },
          ...(missingRemoteClassification
            ? { classification: DEFAULT_SONGBOOK_CLASSIFICATION }
            : {}),
        });
        continue;
      }
    }

    if (normLocalLyrics === normRemoteLyrics) {
      // Exact same lyrics (and title): immediately merge and transfer artists both ways!
      const mergedArtists = mergeArtistsValues(localArtists, remoteArtists);
      const canonicalTitle = remoteDoc.title.trim() || localPayload.title;
      const mergedHash = computeSongContentHash(canonicalTitle, mergedArtists, localPayload.lyrics);
      const mergedSong: Song = {
        ...localSong,
        title: canonicalTitle,
        artist: mergedArtists,
        songbookDocId: remoteDoc.id,
        lastSyncedHash: mergedHash,
      };
      nextLocalSongs.push(mergedSong);

      if (
        remoteDoc.title.trim() !== canonicalTitle ||
        remoteArtists !== mergedArtists ||
        missingRemoteClassification
      ) {
        toUpdateInRemote.push({
          docId: remoteDoc.id,
          payload: {
            title: canonicalTitle,
            artists: mergedArtists,
            lyrics: remoteDoc.lyrics || localPayload.lyrics,
          },
          ...(missingRemoteClassification
            ? { classification: DEFAULT_SONGBOOK_CLASSIFICATION }
            : {}),
        });
      }
      continue;
    }

    // Either manual-merge with differing lyrics, or both changed in auto-sync -> user resolves!
    nextLocalSongs.push(localSong);
    conflicts.push({
      key: `${localSong.id}__${remoteDoc.id}`,
      title: remoteDoc.title.trim() || localSong.title.trim(),
      localSong,
      remoteDoc: {
        ...remoteDoc,
        artists: remoteArtists,
      },
    });
  }

  // Process unmatched local songs
  for (let localIdx = 0; localIdx < localSongs.length; localIdx++) {
    if (matchedLocalIndices.has(localIdx)) continue;
    const localSong = localSongs[localIdx];

    // If auto-sync startup sees a song that WAS previously linked to Firestore and is now gone from Firestore:
    // it was deleted in Songbook, so remove locally too to keep both exact.
    if (options.mode === 'auto-sync' && localSong.songbookDocId) {
      removedLocalIds.push(localSong.id);
      continue;
    }

    // Otherwise (manual-merge or newly created offline), add to Songbook including artists!
    const cleanLocal: Song = {
      ...localSong,
      artist: normalizeArtistsString(localSong.artist),
      songbookDocId: undefined,
    };
    const payload = songToSongbookPayload(cleanLocal);
    nextLocalSongs.push(cleanLocal);
    toCreateInRemote.push({
      localSongId: cleanLocal.id,
      payload,
    });
  }

  // Process unmatched remote songs -> add to local ET BSP including artists!
  for (let remoteIdx = 0; remoteIdx < remoteDocs.length; remoteIdx++) {
    if (matchedRemoteIndices.has(remoteIdx)) continue;
    const remoteDoc = remoteDocs[remoteIdx];
    nextLocalSongs.push(parseSongbookDocToSong(remoteDoc));
    addedFromRemoteCount += 1;

    if (!remoteDoc.classification?.trim()) {
      toUpdateInRemote.push({
        docId: remoteDoc.id,
        payload: {
          title: remoteDoc.title.trim() || 'Untitled Song',
          artists: normalizeArtistsString(remoteDoc.artists),
          lyrics: remoteDoc.lyrics,
        },
        classification: DEFAULT_SONGBOOK_CLASSIFICATION,
      });
    }
  }

  return {
    mergedLocalSongs: sortSongsAlphabetically(nextLocalSongs),
    toCreateInRemote,
    toUpdateInRemote,
    conflicts,
    removedLocalIds,
    addedFromRemoteCount,
  };
}

export function mapSnapshotDoc(id: string, data: Record<string, unknown>): SongbookDocument {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    artists: normalizeArtistsString(data.artists ?? data.artist),
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    classification:
      typeof data.classification === 'string' && data.classification.trim()
        ? data.classification.trim()
        : undefined,
  };
}

export async function fetchAllSongbookDocs(): Promise<SongbookDocument[]> {
  const db = getSongbookDb();
  const snap = await getDocs(collection(db, SONGBOOK_COLLECTION));
  return snap.docs.map((d) => mapSnapshotDoc(d.id, d.data() as Record<string, unknown>));
}

export async function createSongbookDoc(payload: SongbookDocPayload): Promise<string> {
  const db = getSongbookDb();
  const docRef = await addDoc(collection(db, SONGBOOK_COLLECTION), {
    title: payload.title,
    artists: payload.artists,
    lyrics: payload.lyrics,
    classification: DEFAULT_SONGBOOK_CLASSIFICATION,
  });
  return docRef.id;
}

export async function upsertSongbookDoc(
  docId: string,
  payload: SongbookDocPayload,
  classification?: string
): Promise<void> {
  const db = getSongbookDb();
  const data: Record<string, string> = {
    title: payload.title,
    artists: payload.artists,
    lyrics: payload.lyrics,
  };
  if (classification && classification.trim()) {
    data.classification = classification.trim();
  }
  await setDoc(doc(db, SONGBOOK_COLLECTION, docId), data, { merge: true });
}

export async function ensureSongbookClassification(
  docId: string,
  classification: string = DEFAULT_SONGBOOK_CLASSIFICATION
): Promise<void> {
  const db = getSongbookDb();
  await setDoc(doc(db, SONGBOOK_COLLECTION, docId), { classification }, { merge: true });
}

export async function deleteSongbookDoc(docId: string): Promise<void> {
  const db = getSongbookDb();
  await deleteDoc(doc(db, SONGBOOK_COLLECTION, docId));
}

export interface SongbookSubscriptionCallbacks {
  onInitialSnapshot: (docs: SongbookDocument[]) => void;
  onRemoteUpserts: (docs: SongbookDocument[]) => void;
  onRemoteRemovals: (docIds: string[]) => void;
  onError: (err: Error) => void;
}

export function subscribeToSongbookCollection(
  callbacks: SongbookSubscriptionCallbacks
): Unsubscribe {
  const db = getSongbookDb();
  let initialized = false;

  return onSnapshot(
    collection(db, SONGBOOK_COLLECTION),
    (snapshot) => {
      if (!initialized) {
        initialized = true;
        const allDocs = snapshot.docs.map((d) =>
          mapSnapshotDoc(d.id, d.data() as Record<string, unknown>)
        );
        callbacks.onInitialSnapshot(allDocs);
        return;
      }

      const upserts: SongbookDocument[] = [];
      const removals: string[] = [];

      for (const change of snapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          upserts.push(
            mapSnapshotDoc(change.doc.id, change.doc.data() as Record<string, unknown>)
          );
        } else if (change.type === 'removed') {
          removals.push(change.doc.id);
        }
      }

      if (upserts.length > 0) callbacks.onRemoteUpserts(upserts);
      if (removals.length > 0) callbacks.onRemoteRemovals(removals);
    },
    (err) => {
      callbacks.onError(err);
    }
  );
}
