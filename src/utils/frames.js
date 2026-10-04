export const FRAMES = [{ id: '9:16', label: '9:16' }, { id: '16:9', label: '16:9' }, { id: '1:1', label: '1:1' }];
export const frameAspect = (f) => { const [a, b] = f.split(':').map(Number); return a / b; };

/** Export resolutions: [width, height] by ratio and quality. */
export const SIZES = {
  video: {
    '9:16': { standard: [720, 1280], high: [1080, 1920] },
    '16:9': { standard: [1280, 720], high: [1920, 1080] },
    '1:1': { standard: [720, 720], high: [1080, 1080] },
  },
  gif: {
    '9:16': { standard: [320, 568], high: [432, 768] },
    '16:9': { standard: [568, 320], high: [768, 432] },
    '1:1': { standard: [380, 380], high: [512, 512] },
  },
  image: {
    '9:16': { standard: [1080, 1920], high: [1440, 2560] },
    '16:9': { standard: [1920, 1080], high: [2560, 1440] },
    '1:1': { standard: [1080, 1080], high: [1600, 1600] },
  },
};
