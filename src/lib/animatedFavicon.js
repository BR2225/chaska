const ICON_PATH = "/chaska-mark.png";
const FRAME_SIZE = 64;
const FRAME_COUNT = 24;
const FRAME_INTERVAL_MS = 110;

function createFrames(image) {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;

  const context = canvas.getContext("2d");
  if (!context) return [];

  const iconWidth = 58;
  const iconHeight = iconWidth * (image.naturalHeight / image.naturalWidth);

  return Array.from({ length: FRAME_COUNT }, (_, index) => {
    const phase = (index / FRAME_COUNT) * Math.PI * 2;
    const bounce = Math.sin(phase) * 2.5;
    const rotation = Math.sin(phase) * 0.08;
    const squash = 1 + Math.cos(phase) * 0.025;

    context.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    context.save();
    context.translate(FRAME_SIZE / 2, FRAME_SIZE / 2 + bounce);
    context.rotate(rotation);
    context.scale(1 / squash, squash);
    context.drawImage(
      image,
      -iconWidth / 2,
      -iconHeight / 2,
      iconWidth,
      iconHeight,
    );
    context.restore();

    return canvas.toDataURL("image/png");
  });
}

export function startFaviconAnimation() {
  const favicon = document.getElementById("chaska-favicon");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!favicon || reducedMotion.matches) return () => {};

  const image = new Image();
  let intervalId;
  let frameIndex = 0;
  let stopped = false;

  image.addEventListener("load", () => {
    const frames = createFrames(image);
    if (stopped || frames.length === 0) return;

    intervalId = window.setInterval(() => {
      favicon.href = frames[frameIndex];
      frameIndex = (frameIndex + 1) % frames.length;
    }, FRAME_INTERVAL_MS);
  });

  image.src = ICON_PATH;

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    favicon.href = ICON_PATH;
  };
}
