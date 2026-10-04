// Device performance detection → default quality tier.
export function isMobile() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
}

export function detectQuality(caps) {
  if (caps && caps.software) return 'performance';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (isMobile()) return mem >= 6 && cores >= 8 ? 'balanced' : 'performance';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'balanced';
}
