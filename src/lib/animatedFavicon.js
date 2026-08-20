const ICON_PATH = "/chaska-mark.png";
const FRAME_SIZE = 64;
const FRAME_COUNT = 32;
const FRAME_INTERVAL_MS = 100;

function drawSparkle(context, pulse) {
  if (pulse <= 0) return;

  const x = 52;
  const y = 12;
  const outerRadius = 7 * pulse;
  const innerRadius = 2.5 * pulse;

  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  context.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = (point / 8) * Math.PI * 2;
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;
    if (point === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
  context.fillStyle = "#D96C4A";
  context.fill();
  context.restore();
}

function createFrames(image) {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;

  const context = canvas.getContext("2d");
  if (!context) return [];

  const iconWidth = 52;
  const iconHeight = iconWidth * (image.naturalHeight / image.naturalWidth);

  return Array.from({ length: FRAME_COUNT }, (_, index) => {
    const phase = (index / FRAME_COUNT) * Math.PI * 2;
    const bounce = Math.sin(phase) * 6;
    const rotation = Math.sin(phase) * 0.18;
    const squash = 1 + Math.cos(phase) * 0.07;
    const sparklePulse = Math.max(0, Math.sin(phase - Math.PI / 4));

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
    drawSparkle(context, sparklePulse);

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
