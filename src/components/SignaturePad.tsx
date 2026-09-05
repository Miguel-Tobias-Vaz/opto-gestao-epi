import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ImagePlus } from 'lucide-react';

function compactCanvas(source: HTMLCanvasElement) {
  const maxWidth = 520;
  const scale = Math.min(1, maxWidth / source.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return source.toDataURL('image/jpeg', 0.7);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function compactPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      let max = 900;
      let quality = 0.72;
      let data = '';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const scale = Math.min(1, max / image.width, max / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('canvas'));
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL('image/jpeg', quality);
        if (data.length < 180_000) break;
        max = Math.round(max * 0.72);
        quality = Math.max(0.45, quality - 0.1);
      }
      URL.revokeObjectURL(url);
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    image.src = url;
  });
}

export function SignaturePad({
  busy,
  onCancel,
  onSave,
}: {
  busy?: boolean;
  onCancel: () => void;
  onSave: (image: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const emptyRef = useRef(true);
  const [empty, setEmpty] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  const paintBlank = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.4 * ratio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || photo) return;
    paintBlank();
    const observer = new ResizeObserver(() => {
      if (emptyRef.current) paintBlank();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [photo]);

  const point = (event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(event.nativeEvent.pointerId);
    const { x, y } = point(event.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(event.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (emptyRef.current) {
      emptyRef.current = false;
      setEmpty(false);
    }
  };

  const end = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(event.nativeEvent.pointerId);
    } catch {
      /* already released */
    }
  };

  const clear = () => {
    emptyRef.current = true;
    setPhoto(null);
    setPhotoError('');
    setEmpty(true);
    requestAnimationFrame(paintBlank);
  };

  const save = () => {
    if (photo) {
      onSave(photo);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    onSave(compactCanvas(canvas));
  };

  const attach = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Envie uma foto ou um scan da assinatura.');
      return;
    }
    try {
      const data = await compactPhoto(file);
      setPhoto(data);
      setPhotoError('');
    } catch {
      setPhotoError('Não foi possível ler a foto.');
    }
  };

  return (
    <div className="sign-pad">
      {photo ? (
        <img className="sign-photo-preview" src={photo} alt="Foto anexada" />
      ) : (
        <canvas
          ref={canvasRef}
          className="sign-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      )}
      {photoError && <p className="form-error">{photoError}</p>}
      <div className="sign-pad-actions">
        <label className="outline-button sign-file">
          <ImagePlus size={14} /> Anexar foto
          <input type="file" accept="image/*" onChange={attach} disabled={busy} />
        </label>
        <button type="button" className="outline-button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="outline-button" onClick={clear} disabled={busy}>
          Limpar
        </button>
        <button type="button" className="primary-button" onClick={save} disabled={busy || (!photo && empty)}>
          {busy ? 'Salvando...' : photo ? 'Salvar foto' : 'Salvar assinatura'}
        </button>
      </div>
    </div>
  );
}
