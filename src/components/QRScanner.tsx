'use client';

import { Scanner } from '@yudiel/react-qr-scanner';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useEffect, useState } from 'react';

type Props = {
  onResult: (payload: string) => void;
  onRequestManual?: () => void;
};

export default function QRScanner({ onResult, onRequestManual }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [scannerKey, setScannerKey] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    if (navigator?.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then((list) => {
          if (!mounted) return;
          const cams = list.filter((d) => d.kind === 'videoinput');
          setDevices(cams);
          if (!selectedDeviceId && cams.length > 0) {
            setSelectedDeviceId(cams[0].deviceId);
          }
        })
        .catch((e) => {
          const msg = (e?.message as string) || 'Unable to list camera devices';
          setError(msg);
        });
    }
    return () => { mounted = false; };
  }, []);

  return (
    <div className="w-full">
      {enabled && (
        <Scanner
          key={scannerKey}
          onScan={(detectedCodes: IDetectedBarcode[]) => {
            setError(null);
            const text = detectedCodes?.[0]?.rawValue;
            if (text) onResult(text);
          }}
          onError={(err: unknown) => {
            let msg = 'Scan error';
            if (err && typeof err === 'object') {
              const e = err as { name?: string; message?: string };
              msg = e?.name === 'NotReadableError'
                ? 'Camera is in use by another app or tab. Close it and retry.'
                : e?.message ?? msg;
              if (e?.name === 'NotReadableError' || e?.name === 'NotAllowedError') {
                // Offer a quick fallback to manual entry when camera is busy or blocked
                onRequestManual?.();
              }
            }
            setError(msg);
            setEnabled(false);
          }}
          constraints={{
            facingMode: 'environment',
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } as any : undefined,
            advanced: [{ torch: false }] as any,
          }}
        />
      )}
      <div className="mt-2 flex items-center gap-2">
        {devices.length > 0 && (
          <select
            className="rounded border px-2 py-1"
            value={selectedDeviceId || ''}
            onChange={(e) => {
              const id = e.target.value || undefined;
              setSelectedDeviceId(id);
              setScannerKey((k) => k + 1);
            }}
            title="Select camera"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
        {!enabled ? (
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-white"
            onClick={() => {
              setError(null);
              setScannerKey((k) => k + 1);
              setEnabled(true);
            }}
          >
            Retry camera
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-gray-600 px-3 py-1 text-white"
            onClick={() => {
              setEnabled(false);
            }}
          >
            Stop camera
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}