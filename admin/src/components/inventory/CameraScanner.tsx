import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { BarcodeDetector } from 'barcode-detector/ponyfill';
import { CircleAlert, CircleCheck, Flashlight, FlashlightOff, Loader2, VideoOff, ZoomIn } from 'lucide-react';
import { loadBarcodeDetector, scanFeedback } from '../../lib/scanner';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface ScanOutcome {
  /** Flashed over the picture, e.g. "Butter · 3 pcs". */
  label: string;
  tone: 'success' | 'warning';
}

type CameraProblem = 'denied' | 'no-camera' | 'failed';

/** How often a frame is read. */
const SCAN_INTERVAL_MS = 120;
/** A code held in view reads many times a second; it only counts again after this long out of view. */
const REPEAT_MS = 1200;
/** Frames are scaled to at most this width before reading — enough for small barcodes. */
const MAX_FRAME_WIDTH = 1280;

const onVisibility = (fn: () => void) => {
  document.addEventListener('visibilitychange', fn);
  return () => document.removeEventListener('visibilitychange', fn);
};
const isVisible = () => document.visibilityState === 'visible';

type Caps = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number } };

/**
 * The part of the camera frame under the on-screen scan box, plus a margin so
 * a code needn't sit perfectly inside. The video is `object-fit: cover`, so
 * the frame is scaled and cropped before it is shown — undo that here.
 */
function cropToBox(video: HTMLVideoElement, frame: HTMLElement, box: HTMLElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const f = frame.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (!vw || !vh || !f.width || !f.height) return null;
  const scale = Math.max(f.width / vw, f.height / vh);
  const offX = (f.width - vw * scale) / 2;
  const offY = (f.height - vh * scale) / 2;
  const margin = 0.15;
  const sx = Math.max(0, (b.left - f.left - b.width * margin - offX) / scale);
  const sy = Math.max(0, (b.top - f.top - b.height * margin - offY) / scale);
  const sw = Math.min(vw - sx, (b.width * (1 + 2 * margin)) / scale);
  const sh = Math.min(vh - sy, (b.height * (1 + 2 * margin)) / scale);
  return sw > 10 && sh > 10 ? { sx, sy, sw, sh } : null;
}

/**
 * Live barcode / QR reader using the phone camera. The camera stays on
 * between scans; each new code goes to `onScan`, whose answer flashes over the
 * picture with a beep. It switches off when unmounted or when the phone locks
 * or changes app, and back on when the page is visible again.
 */
export function CameraScanner({
  onScan,
  paused = false,
  className,
}: {
  onScan: (code: string) => ScanOutcome | null | undefined;
  /** Camera stays on but codes are ignored (e.g. a dialog is open on top). */
  paused?: boolean;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const visible = useSyncExternalStore(onVisibility, isVisible);
  const supported = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

  const [attempt, setAttempt] = useState(0);
  const [live, setLive] = useState(false);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [zoom, setZoom] = useState<{ max: number; level: number } | null>(null);
  const [flash, setFlash] = useState<(ScanOutcome & { id: number }) | null>(null);

  const isPaused = useEffectEvent(() => paused);
  const handle = useEffectEvent((code: string) => {
    const result = onScan(code);
    if (!result) return;
    scanFeedback(result.tone === 'success');
    setFlash({ ...result, id: Date.now() });
  });

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!supported || !visible) return;
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let last = { code: '', at: 0 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stop = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      trackRef.current = null;
    };

    const tick = async (detector: BarcodeDetector) => {
      if (cancelled) return;
      const region = video && frameRef.current && boxRef.current ? cropToBox(video, frameRef.current, boxRef.current) : null;
      if (!isPaused() && video && ctx && region && video.readyState >= 2) {
        const scale = Math.min(1, MAX_FRAME_WIDTH / region.sw);
        canvas.width = Math.round(region.sw * scale);
        canvas.height = Math.round(region.sh * scale);
        ctx.drawImage(video, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);
        try {
          const [hit] = await detector.detect(canvas);
          if (hit?.rawValue && !cancelled) {
            const now = performance.now();
            const repeat = hit.rawValue === last.code && now - last.at < REPEAT_MS;
            last = { code: hit.rawValue, at: now };
            if (!repeat) handle(hit.rawValue);
          }
        } catch {
          // An unreadable frame; the next one will do.
        }
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(detector), SCAN_INTERVAL_MS);
    };

    void (async () => {
      // Fetch the reader while the camera permission is being asked for.
      const detectorReady = loadBarcodeDetector();
      detectorReady.catch(() => undefined);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // High resolution lets small barcodes read from far enough away to focus.
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled || !video) return stop();
        video.muted = true;
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as Caps;
        setTorch({ supported: !!caps.torch, on: false });
        setZoom(caps.zoom && caps.zoom.max >= 2 ? { max: Math.min(caps.zoom.max, 3), level: 1 } : null);

        const detector = await detectorReady;
        if (cancelled) return;
        setProblem(null);
        setLive(true);
        void tick(detector);
      } catch (err) {
        stop();
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        setProblem(
          name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-camera' : 'failed'
        );
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
      if (video) video.srcObject = null;
      setLive(false);
    };
  }, [supported, visible, attempt]);

  const toggleTorch = async () => {
    const on = !torch.on;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  const cycleZoom = async () => {
    if (!zoom) return;
    const level = zoom.level >= zoom.max ? 1 : Math.min(zoom.level + 1, zoom.max);
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ zoom: level } as MediaTrackConstraintSet] });
      setZoom({ ...zoom, level });
    } catch {
      setZoom(null);
    }
  };

  const message = !supported
    ? { title: 'No camera on this link', body: 'The camera only works when the Studio is opened from its secure https:// address.' }
    : problem === 'denied'
      ? { title: 'Camera access is off', body: 'On iPhone: tap “aA” in the address bar → Website Settings → Camera → Allow. On Android: tap the lock icon → Permissions. Then try again.' }
      : problem === 'no-camera'
        ? { title: 'No camera found', body: 'This device has no camera we can use. You can still search for items by name.' }
        : problem === 'failed'
          ? { title: 'The camera didn’t start', body: 'Close any other app using the camera, then try again.' }
          : null;

  return (
    <div ref={frameRef} className={cn('relative isolate overflow-hidden bg-plum-900', className)}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-hidden />

      {/* The scan box; its huge shadow dims everything around it. */}
      <div
        ref={boxRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 h-[54%] w-[80%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-[0_0_0_9999px_rgb(46_5_38/0.45)] outline outline-[3px] transition-[outline-color] duration-150',
          flash ? (flash.tone === 'success' ? 'outline-mint' : 'outline-honey-200') : 'outline-peach/90'
        )}
      >
        {!flash && <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-cherry/80" />}
      </div>

      {live && !message && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-3" aria-live="polite">
          {flash ? (
            <span
              key={flash.id}
              className={cn(
                'flex max-w-full animate-rise items-center gap-1.5 truncate rounded-full px-4 py-2 text-sm font-semibold shadow-lift',
                flash.tone === 'success' ? 'bg-card text-mint-700' : 'bg-honey-50 text-honey-700'
              )}
            >
              {flash.tone === 'success' ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{flash.label}</span>
            </span>
          ) : (
            <span className="rounded-full bg-plum-900/60 px-3 py-1.5 text-xs font-medium text-cream">
              {paused ? 'Paused' : 'Hold a barcode or QR label in the box · about 20 cm away'}
            </span>
          )}
        </div>
      )}

      {live && !message && (torch.supported || zoom) && (
        <div className="absolute right-2 top-2 flex gap-2">
          {zoom && (
            <button
              type="button"
              onClick={() => void cycleZoom()}
              className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-plum-900/60 px-3 text-sm font-semibold text-cream"
              aria-label={`Zoom, now ${zoom.level}×`}
            >
              <ZoomIn className="size-4" aria-hidden /> {zoom.level}×
            </button>
          )}
          {torch.supported && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className={cn('flex size-11 items-center justify-center rounded-full', torch.on ? 'bg-peach text-plum-900' : 'bg-plum-900/60 text-cream')}
              aria-label={torch.on ? 'Turn the light off' : 'Turn the light on'}
              aria-pressed={torch.on}
            >
              {torch.on ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
            </button>
          )}
        </div>
      )}

      {message ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-plum-900 px-6 text-center text-cream">
          <VideoOff className="size-7 text-peach" aria-hidden />
          <p className="font-display text-lg font-semibold">{message.title}</p>
          <p className="max-w-sm text-sm text-cream/75">{message.body}</p>
          {supported && (
            <Button
              variant="peach"
              size="sm"
              className="mt-2"
              onClick={() => {
                setProblem(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          )}
        </div>
      ) : (
        !live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-cream/80">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            Waking up the camera…
          </div>
        )
      )}
    </div>
  );
}
