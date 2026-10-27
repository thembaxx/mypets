'use client';
import { useEffect, useState } from 'react';
import {
  CopyIcon,
  DownloadSimpleIcon,
  ShareNetworkIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react';
import type { AppData } from '@/lib/storage';
import {
  buildCaregiverHandoff,
  handoffFilename,
  handoffText,
  type CaregiverHandoff as Handoff,
} from '@/lib/handoff';
import { IconButton } from './shared';

export function CaregiverHandoff({ data, petId }: { data: AppData; petId: string }) {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    setHandoff(buildCaregiverHandoff(data, petId));
    setStatus('');
  }, [data, petId]);
  if (!data.pets.some((pet) => pet.id === petId)) {
    return (
      <p role="alert">
        This pet is no longer in the workspace. Select another pet to prepare a handoff.
      </p>
    );
  }
  if (!handoff) return <p role="status">Preparing the selected pet’s handoff…</p>;
  const text = handoffText(handoff);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = handoffFilename(handoff);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Text download prepared. Keep your copy private.');
    } catch {
      setStatus('The download could not be prepared. Try copying the text.');
    }
  };
  const share = async () => {
    if (!navigator.share) {
      setStatus('This browser has no share menu. Download or copy the handoff instead.');
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: `${handoff.pet.name} · caregiver handoff`, text });
      setStatus('Handoff passed to your device’s sharing app. Delivery is handled there.');
    } catch (error) {
      setStatus(
        error instanceof Error && error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : 'Sharing did not complete. Try downloading or copying the text.',
      );
    } finally {
      setSharing(false);
    }
  };
  return (
    <section className="settings-detail" aria-label={`${handoff.pet.name} caregiver handoff`}>
      <span className="eyebrow">ONE PET · A SHARED MOMENT</span>
      <h3>{handoff.pet.name}’s caregiver handoff</h3>
      <p>
        Review the preview before sharing. It includes this pet’s saved profile, recent records and
        upcoming tasks.
      </p>
      {handoff.sample && (
        <p className="history-demo">
          Sample workspace. These are demonstration records, not actual care.
        </p>
      )}
      <p className="fine-print">
        Generated {new Date(handoff.generatedAt).toLocaleString()} · {handoff.timeZone}. Photos,
        companion chats and other pets are excluded.
      </p>
      <div className="settings-row">
        <div>
          <strong>Refresh this snapshot</strong>
          <span>Include your latest saved changes and current time.</span>
        </div>
        <IconButton
          label="Refresh handoff preview"
          disabled={sharing}
          onClick={() => {
            setHandoff(buildCaregiverHandoff(data, petId));
            setStatus('Preview refreshed.');
          }}
        >
          <ArrowClockwiseIcon size={23} />
        </IconButton>
      </div>
      <label className="form-label">
        Handoff preview
        <textarea readOnly rows={16} value={text} style={{ width: '100%', resize: 'vertical' }} />
      </label>
      <div className="settings-row">
        <div>
          <strong>Download text</strong>
          <span>Save a plain-text copy to your device.</span>
        </div>
        <IconButton label="Download caregiver handoff" onClick={download}>
          <DownloadSimpleIcon size={23} />
        </IconButton>
      </div>
      <div className="settings-row">
        <div>
          <strong>Share handoff</strong>
          <span>Choose a destination in your device’s sharing menu.</span>
        </div>
        <IconButton
          label="Share caregiver handoff"
          disabled={sharing}
          onClick={() => {
            void share();
          }}
        >
          <ShareNetworkIcon size={23} />
        </IconButton>
      </div>
      <div className="settings-row">
        <div>
          <strong>Copy text</strong>
          <span>Paste it into a message yourself.</span>
        </div>
        <IconButton
          label="Copy caregiver handoff"
          onClick={() => {
            if (!navigator.clipboard) {
              setStatus('Clipboard access is unavailable. Select the preview text or download it.');
              return;
            }
            void navigator.clipboard.writeText(text).then(
              () => setStatus('Handoff text copied.'),
              () => setStatus('Copying was blocked. Select the preview text or download it.'),
            );
          }}
        >
          <CopyIcon size={23} />
        </IconButton>
      </div>
      <p className="fine-print" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
