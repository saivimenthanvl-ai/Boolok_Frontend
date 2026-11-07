import { API_BASE_URL, resolveImageUrl } from './api';

// The backend assigns a random Unsplash stock photo as poster/thumbnail when a reel
// is uploaded without a cover. Those images are unrelated to the video, so treat
// them as "no cover" and show a frame from the reel itself instead.
export function isStockCover(url?: string | null): boolean {
  return typeof url === 'string' && url.includes('images.unsplash.com');
}

export function getReelCoverUrl(reel: any): string | null {
  for (const candidate of [reel?.thumbnail, reel?.poster]) {
    const resolved = resolveImageUrl(candidate);
    if (resolved && !isStockCover(resolved)) return resolved;
  }
  return null;
}

export function getReelVideoUrl(reel: any): string | null {
  const raw = reel?.videoUrl;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const clean = raw.trim();
  if (clean.startsWith('blob:') || clean.startsWith('data:')) return clean;
  const m = clean.match(/\/uploads\/reels\/([^/?#]+)/);
  if (m) return `${API_BASE_URL}/api/reels/stream/${m[1]}`;
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${API_BASE_URL}${clean.startsWith('/') ? clean : `/${clean}`}`;
}

// Web only: grab a JPEG frame from a local video so uploads get a real cover.
export function captureVideoFrame(videoUri: string, atSeconds = 0.5): Promise<Blob | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 10000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = duration > 0 ? Math.min(atSeconds, duration / 2) : 0;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85);
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    video.src = videoUri;
  });
}
