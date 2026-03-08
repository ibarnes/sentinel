export async function renderHighlightDataUrl({ screenshotDataUrl, elementBox, label }) {
  if (!screenshotDataUrl || !elementBox) {
    return { ok: false, reason: 'missing_source_or_box' };
  }

  const box = normalizeBox(elementBox);
  if (!box) return { ok: false, reason: 'invalid_box' };

  try {
    const blob = await (await fetch(screenshotDataUrl)).blob();
    const bmp = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no_2d_context' };

    ctx.drawImage(bmp, 0, 0);

    const sx = clamp(Math.round(box.x), 0, bmp.width - 1);
    const sy = clamp(Math.round(box.y), 0, bmp.height - 1);
    const sw = clamp(Math.round(box.width), 1, bmp.width - sx);
    const sh = clamp(Math.round(box.height), 1, bmp.height - sy);

    // Soft dim outside target region.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, bmp.width, bmp.height);
    ctx.clearRect(sx, sy, sw, sh);

    // Bounding box.
    ctx.strokeStyle = '#27c1ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, sw, sh);

    // Optional label marker.
    const tag = String(label || 'Target').slice(0, 32);
    if (tag) {
      ctx.font = 'bold 14px sans-serif';
      const padX = 8;
      const padY = 6;
      const tw = Math.ceil(ctx.measureText(tag).width);
      const lw = tw + padX * 2;
      const lh = 22;
      const lx = sx;
      const ly = Math.max(0, sy - lh - 4);
      ctx.fillStyle = 'rgba(39, 193, 255, 0.95)';
      ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = '#001018';
      ctx.fillText(tag, lx + padX, ly + lh - padY);
    }

    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.84 });
    const outDataUrl = await blobToDataUrl(outBlob);
    return {
      ok: true,
      dataUrl: outDataUrl,
      metadata: {
        width: bmp.width,
        height: bmp.height,
        box: { x: sx, y: sy, width: sw, height: sh },
        mode: 'rendered'
      }
    };
  } catch (error) {
    return { ok: false, reason: 'render_exception', error: String(error?.message || error) };
  }
}

function normalizeBox(box) {
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
