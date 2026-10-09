import type { BarcodeDetector, BarcodeFormat } from 'barcode-detector/ponyfill';

/**
 * Pack barcodes (EAN/UPC), Code 128/39 from wholesale cartons, and the QR
 * codes on our own shelf labels. A short list keeps every frame fast.
 */
const FORMATS: BarcodeFormat[] = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

let detectorPromise: Promise<BarcodeDetector> | null = null;

/**
 * The barcode reader, fetched the first time a camera opens so the rest of
 * the Studio never pays for it. iPhone Safari has no native BarcodeDetector,
 * so ZXing (WebAssembly) is always used: one code path on every phone. The
 * .wasm is bundled and served from this site, not a public CDN.
 */
export function loadBarcodeDetector(): Promise<BarcodeDetector> {
  detectorPromise ??= (async () => {
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
      },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: FORMATS });
  })().catch((err) => {
    // Let "Try again" after a network blip start from scratch.
    detectorPromise = null;
    throw err;
  });
  return detectorPromise;
}

let audio: AudioContext | null = null;

/**
 * Phones only let a page make sound after a tap. Call this from the tap that
 * opens a scanner (iOS especially) so the beep can play later.
 */
export function unlockScanSound() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // No Web Audio: scans still show on screen.
  }
}

/** A short beep — bright for a match, low for a problem — and a buzz on Android. */
export function scanFeedback(ok: boolean) {
  try {
    if (audio && audio.state === 'running') {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = ok ? 1320 : 330;
      gain.gain.setValueAtTime(0.18, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (ok ? 0.09 : 0.25));
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + (ok ? 0.1 : 0.26));
    }
  } catch {
    // Sound is a nicety; never let it break scanning.
  }
  navigator.vibrate?.(ok ? 40 : [60, 50, 60]);
}
