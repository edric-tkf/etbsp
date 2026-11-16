import React, { useEffect, useState } from 'react';
import type { CustomFont, DisplaySettings, PresentationState } from '../types/models';
import {
  DEFAULT_DISPLAY_SETTINGS,
  INITIAL_PRESENTATION_STATE,
  normalizeDisplaySettings,
} from '../data/seedData';
import { LS_KEYS, loadWorkspaceData } from '../utils/storage';
import { loadCustomFontsIntoDocument } from '../utils/fontEngine';
import { PresentationSyncClient } from '../utils/syncEngine';
import { PresentationCanvas } from './PresentationCanvas';

export const DisplayPage: React.FC = () => {
  const [presentation, setPresentation] = useState<PresentationState>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.PRESENTATION);
      return raw ? (JSON.parse(raw) as PresentationState) : INITIAL_PRESENTATION_STATE;
    } catch {
      return INITIAL_PRESENTATION_STATE;
    }
  });

  const [settings, setSettings] = useState<DisplaySettings>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.DISPLAY_SETTINGS);
      return raw
        ? normalizeDisplaySettings(JSON.parse(raw) as DisplaySettings)
        : DEFAULT_DISPLAY_SETTINGS;
    } catch {
      return DEFAULT_DISPLAY_SETTINGS;
    }
  });

  const [customFonts, setCustomFonts] = useState<CustomFont[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.CUSTOM_FONTS);
      return raw ? (JSON.parse(raw) as CustomFont[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    loadCustomFontsIntoDocument(customFonts);
  }, [customFonts]);

  useEffect(() => {
    let mounted = true;
    loadWorkspaceData().then((data) => {
      if (!mounted) return;
      setPresentation(data.presentationState);
      setSettings(data.displaySettings);
      if (data.customFonts.length > 0) {
        setCustomFonts(data.customFonts);
      }
    });

    const sync = new PresentationSyncClient('display', {
      onPresentationUpdate: (nextState) => {
        if (mounted) setPresentation(nextState);
      },
      onSettingsUpdate: (nextSettings) => {
        if (mounted) setSettings(normalizeDisplaySettings(nextSettings));
      },
      onFontsUpdate: (nextFonts) => {
        if (mounted) setCustomFonts(nextFonts);
      },
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      mounted = false;
      window.removeEventListener('keydown', onKeyDown);
      sync.dispose();
    };
  }, []);

  const isTransparent =
    settings.transparentBackground ||
    settings.backgroundType === 'transparent' ||
    (presentation.isLive &&
      presentation.activeType !== 'none' &&
      presentation.bibleDisplayMode === 'lower-third');

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex items-center justify-center ${
        isTransparent ? 'bg-transparent' : 'bg-black'
      }`}
      onDoubleClick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }}
    >
      <div className="w-[min(100vw,177.78vh)] h-[min(100vh,56.25vw)] aspect-video">
        <PresentationCanvas presentation={presentation} settings={settings} />
      </div>
    </div>
  );
};
