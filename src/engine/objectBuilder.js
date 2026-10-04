// "Object config" (from the UI store) → engine-ready object.  Async because fonts, images and video load.

import { rasterizeText, rasterizeImage, rasterizeVideo, buildObject, ensureFont } from './sampler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function makeObject(cfg, frameAspect = 1) {
  if (cfg.kind === 'text') {
    await ensureFont(cfg.font, cfg.weight);
    await tick();
    return buildObject(rasterizeText({
      text: cfg.text && cfg.text.trim() ? cfg.text : 'TYPE SOMETHING', font: cfg.font, weight: cfg.weight, spacing: cfg.spacing, lineHeight: cfg.lineHeight, align: cfg.align,
    }, frameAspect));
  }
  if (!cfg.fileUrl) return makeObject({ ...cfg, kind: 'text' }, frameAspect);
  if (cfg.overlayText && cfg.overlayText.trim()) {
    await ensureFont(cfg.font || 'display', cfg.weight || 800);
  }
  if (cfg.kind === 'video') {
    const r = await rasterizeVideo(cfg.fileUrl);
    await tick();
    return buildObject(r);
  }
  const isSvg = /svg/i.test(cfg.fileType) || /\.svg$/i.test(cfg.fileName);
  const r = await rasterizeImage(cfg.fileUrl, {
    isSvg,
    text: cfg.overlayText || '',
    fontKey: cfg.font || 'display',
    weight: cfg.weight || 800,
    textPos: cfg.textPos || 'bottom',
    textColor: '#ffffff',
  });
  await tick();
  return buildObject(r);
}
