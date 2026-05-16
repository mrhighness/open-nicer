/** Client-side cartoon avatar when paid AI APIs are unavailable (approximates 3D toon look). */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function posterize(value: number, levels: number) {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(value / step) * step);
}

/** Photo → toon-style PNG (browser-only; cloud AI gives true 3D Bitmoji look). */
export async function stylizePhotoLocally(file: File, size = 512): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const min = Math.min(img.width, img.height);
  const sx = (img.width - min) / 2;
  const sy = (img.height - min) / 2;

  ctx.fillStyle = "#2d1b4e";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.filter = "saturate(1.4) contrast(1.15) brightness(1.05)";
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, size, size);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const levels = lum > 180 ? 5 : 7;
    d[i] = posterize(d[i], levels);
    d[i + 1] = posterize(d[i + 1], levels);
    d[i + 2] = posterize(d[i + 2], levels);
    d[i] = Math.min(255, d[i] * 0.65 + 200 * 0.35);
    d[i + 1] = Math.min(255, d[i + 1] * 0.5 + 80 * 0.5);
    d[i + 2] = Math.min(255, d[i + 2] * 0.75 + 220 * 0.25);
  }
  ctx.putImageData(imageData, 0, 0);

  ctx.globalCompositeOperation = "soft-light";
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.4, size * 0.05, size * 0.5, size * 0.5, size * 0.6);
  grad.addColorStop(0, "rgba(255, 120, 200, 0.25)");
  grad.addColorStop(1, "rgba(80, 20, 120, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export image"))),
      "image/png",
      0.92
    );
  });
}
