'use client';

/**
 * PhotoStudio — éditeur de photo « site-ready » côté navigateur.
 *
 * Pipeline (identique au traitement manuel des cutouts de l'équipe) :
 *   1. Détourage automatique du fond  (@imgly/background-removal, 100 % navigateur)
 *   2. Rognage automatique sur la boîte alpha (on enlève les marges transparentes)
 *   3. Recomposition sur un canevas carré, sujet ancré en bas, ~88 % de la hauteur
 *   4. Export WebP transparent → envoyé tel quel à l'API (qui ne fait que stocker)
 *
 * Le but : n'importe qui peut changer sa photo et obtenir un rendu cohérent avec
 * le reste de l'équipe sur le site public, sans passer par un outil externe.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Upload, Loader2, Wand2, RotateCcw, Check, X,
  ImageOff, ZoomIn, AlertTriangle,
} from 'lucide-react';

const DUO = {
  green: '#58CC02', greenDark: '#45a300',
  blue: '#1CB0F6', blueDark: '#1899d6',
  purple: '#CE82FF', purpleDark: '#b06edb',
} as const;

// Canevas d'export : carré, comme les cutouts existants de l'équipe.
const SIZE = 600;
// Le sujet occupe ~88 % de la hauteur (même proportion que les photos actuelles).
const CONTENT_HEIGHT_RATIO = 0.88;
// Résolution de travail (on plafonne pour la mémoire / la vitesse de scan alpha).
const WORK_MAX = 1400;

interface PhotoStudioProps {
  open: boolean;
  onClose: () => void;
  /** Reçoit le WebP final détouré + recadré. Le parent s'occupe de l'upload. */
  onApply: (file: File) => Promise<void> | void;
  displayName?: string;
  roleTitle?: string;
  initials?: string;
}

type Stage = 'pick' | 'processing' | 'edit' | 'uploading';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Boîte englobante des pixels non transparents (alpha > seuil). */
function alphaBBox(data: Uint8ClampedArray, w: number, h: number, threshold = 16) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h }; // image vide → tout
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Vrai si les coins de l'image sont déjà transparents (photo déjà détourée). */
function looksTransparent(data: Uint8ClampedArray, w: number, h: number) {
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  return corners.every(i => data[i + 3] < 24);
}

export function PhotoStudio({ open, onClose, onApply, displayName, roleTitle, initials }: PhotoStudioProps) {
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [warn, setWarn] = useState('');
  const [removeBg, setRemoveBg] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');

  // Sources de travail (image détourée mise à l'échelle + sa boîte alpha).
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const bboxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const originalFileRef = useRef<File | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    setStage('pick'); setProgress(0); setProgressLabel(''); setError(''); setWarn('');
    setRemoveBg(true); setZoom(1); setOffX(0); setOffY(0); setPreviewUrl('');
    workRef.current = null; bboxRef.current = null; originalFileRef.current = null;
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  /** Échelle de base : sujet à 88 % de hauteur, sans déborder en largeur. */
  function baseFit(bb: { w: number; h: number }) {
    const byHeight = (CONTENT_HEIGHT_RATIO * SIZE) / bb.h;
    const byWidth = (0.96 * SIZE) / bb.w;
    return Math.min(byHeight, byWidth);
  }

  /** Redessine le canevas d'export (transparent) + génère l'aperçu carte. */
  const compose = useCallback(() => {
    const work = workRef.current, bb = bboxRef.current, out = exportCanvasRef.current;
    if (!work || !bb || !out) return;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const scale = baseFit(bb) * zoom;
    const cw = bb.w * scale, ch = bb.h * scale;
    const dx = (SIZE - cw) / 2 + offX;   // centré horizontalement
    const dy = (SIZE - ch) + offY;       // ancré en bas
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(work, bb.x, bb.y, bb.w, bb.h, dx, dy, cw, ch);
    setPreviewUrl(out.toDataURL('image/png'));
  }, [zoom, offX, offY]);

  useEffect(() => { if (stage === 'edit') compose(); }, [stage, compose]);

  /** Charge un fichier, détoure (si activé), prépare le canevas de travail. */
  const processFile = useCallback(async (file: File, doRemove: boolean) => {
    setError(''); setWarn(''); setStage('processing'); setProgress(0);
    setProgressLabel(doRemove ? 'Préparation du détourage…' : 'Préparation…');
    try {
      let bitmapSrc: string;
      let didRemove = false;

      // L'image est-elle déjà détourée ? (on évite un détourage inutile)
      const probe = await loadImage(URL.createObjectURL(file));
      const pc = document.createElement('canvas');
      const pscale = Math.min(1, WORK_MAX / Math.max(probe.width, probe.height));
      pc.width = Math.round(probe.width * pscale);
      pc.height = Math.round(probe.height * pscale);
      const pctx = pc.getContext('2d', { willReadFrequently: true })!;
      pctx.drawImage(probe, 0, 0, pc.width, pc.height);
      const already = looksTransparent(pctx.getImageData(0, 0, pc.width, pc.height).data, pc.width, pc.height);

      if (doRemove && !already) {
        setProgressLabel('Détourage du fond (1er usage : téléchargement du modèle)…');
        const { removeBackground } = await import('@imgly/background-removal');
        const blob = await removeBackground(file, {
          output: { format: 'image/png' },
          progress: (key: string, current: number, total: number) => {
            if (total) setProgress(Math.round((current / total) * 100));
            if (key.startsWith('fetch')) setProgressLabel('Téléchargement du modèle de détourage…');
            else if (key.startsWith('compute')) setProgressLabel('Détourage en cours…');
          },
        });
        bitmapSrc = URL.createObjectURL(blob);
        didRemove = true;
      } else {
        bitmapSrc = URL.createObjectURL(file);
        if (doRemove && already) setWarn('Photo déjà détourée détectée — détourage sauté.');
      }

      // Canevas de travail à résolution plafonnée.
      const img = await loadImage(bitmapSrc);
      const scale = Math.min(1, WORK_MAX / Math.max(img.width, img.height));
      const work = document.createElement('canvas');
      work.width = Math.round(img.width * scale);
      work.height = Math.round(img.height * scale);
      const wctx = work.getContext('2d', { willReadFrequently: true })!;
      wctx.drawImage(img, 0, 0, work.width, work.height);

      const imgData = wctx.getImageData(0, 0, work.width, work.height).data;
      const transparent = didRemove || looksTransparent(imgData, work.width, work.height);
      if (!transparent) {
        setWarn("Aucun fond transparent : la photo sera placée telle quelle. Pour un beau rendu, utilise une photo sur fond uni ou laisse le détourage activé.");
      }
      const bb = transparent
        ? alphaBBox(imgData, work.width, work.height)
        : { x: 0, y: 0, w: work.width, h: work.height };

      workRef.current = work;
      bboxRef.current = bb;
      setZoom(1); setOffX(0); setOffY(0);
      setStage('edit');
    } catch (e) {
      console.error(e);
      setError("Le détourage automatique a échoué (réseau bloqué ou image non supportée). Réessaie, ou décoche « Détourer le fond » et fournis une photo déjà détourée.");
      // On tente quand même un mode dégradé avec l'image brute.
      try {
        const img = await loadImage(URL.createObjectURL(file));
        const scale = Math.min(1, WORK_MAX / Math.max(img.width, img.height));
        const work = document.createElement('canvas');
        work.width = Math.round(img.width * scale);
        work.height = Math.round(img.height * scale);
        work.getContext('2d')!.drawImage(img, 0, 0, work.width, work.height);
        workRef.current = work;
        bboxRef.current = { x: 0, y: 0, w: work.width, h: work.height };
        setZoom(1); setOffX(0); setOffY(0);
        setStage('edit');
      } catch { setStage('pick'); }
    }
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError('Fichier trop volumineux (max 15 Mo).'); return; }
    originalFileRef.current = file;
    processFile(file, removeBg);
  }

  // Bascule du détourage en cours d'édition → on retraite le fichier d'origine.
  function toggleRemove() {
    const next = !removeBg;
    setRemoveBg(next);
    if (originalFileRef.current) processFile(originalFileRef.current, next);
  }

  // Glisser pour repositionner le sujet.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const k = SIZE / rect.width; // px affichés → px canevas
    const dx = (e.clientX - dragRef.current.x) * k;
    const dy = (e.clientY - dragRef.current.y) * k;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setOffX(v => v + dx); setOffY(v => v + dy);
  }
  function onPointerUp() { dragRef.current = null; }

  async function handleApply() {
    const out = exportCanvasRef.current;
    if (!out) return;
    compose();
    setStage('uploading');
    out.toBlob(async (blob) => {
      if (!blob) { setError('Export impossible.'); setStage('edit'); return; }
      const file = new File([blob], 'photo.webp', { type: 'image/webp' });
      try {
        await onApply(file);
        onClose();
      } catch {
        setError("L'envoi a échoué. Réessaie.");
        setStage('edit');
      }
    }, 'image/webp', 0.92);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && stage !== 'processing' && stage !== 'uploading') onClose(); }}
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${DUO.blue}15` }}>
              <Camera className="h-5 w-5" style={{ color: DUO.blue }} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-main leading-tight">Studio photo</h2>
              <p className="text-xs text-text-muted">Détourage + cadrage automatiques pour le site</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={stage === 'processing' || stage === 'uploading'}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* ÉTAPE 1 — Choix du fichier */}
          {stage === 'pick' && (
            <div className="text-center py-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto max-w-md cursor-pointer rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#1CB0F6] transition-all p-10 group"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${DUO.blue}15` }}>
                  <Upload className="h-8 w-8" style={{ color: DUO.blue }} />
                </div>
                <p className="text-base font-extrabold text-text-main">Choisir une photo</p>
                <p className="text-sm text-text-muted mt-1">JPG, PNG ou WebP — max 15 Mo</p>
                <p className="text-xs text-text-muted mt-3">Le fond sera retiré automatiquement et la photo cadrée comme le reste de l&apos;équipe.</p>
              </div>
              {error && <p className="text-sm text-red-500 mt-4 font-semibold">{error}</p>}
            </div>
          )}

          {/* ÉTAPE 2 — Traitement */}
          {stage === 'processing' && (
            <div className="text-center py-14">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <Wand2 className="h-20 w-20 absolute inset-0 opacity-10" style={{ color: DUO.purple }} />
                <Loader2 className="h-20 w-20 animate-spin" style={{ color: DUO.purple }} />
              </div>
              <p className="text-sm font-extrabold text-text-main">{progressLabel || 'Traitement…'}</p>
              <div className="mx-auto mt-4 h-2 w-64 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: DUO.purple }} />
              </div>
              <p className="text-xs text-text-muted mt-3">Le 1ᵉʳ détourage télécharge un modèle (quelques Mo), ensuite c&apos;est instantané.</p>
            </div>
          )}

          {/* ÉTAPE 3 — Édition / aperçu */}
          {(stage === 'edit' || stage === 'uploading') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Zone d'ajustement (résultat transparent) */}
              <div>
                <p className="text-xs font-extrabold text-text-muted uppercase tracking-wider mb-2">Ajuster (glisser pour déplacer)</p>
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-gray-100"
                  style={{
                    backgroundColor: '#f8fafc',
                    backgroundImage: 'linear-gradient(45deg,#eef2f7 25%,transparent 25%),linear-gradient(-45deg,#eef2f7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2f7 75%),linear-gradient(-45deg,transparent 75%,#eef2f7 75%)',
                    backgroundSize: '18px 18px',
                    backgroundPosition: '0 0,0 9px,9px -9px,-9px 0',
                  }}
                >
                  <canvas
                    ref={exportCanvasRef}
                    width={SIZE}
                    height={SIZE}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="w-full h-auto block touch-none cursor-grab active:cursor-grabbing"
                  />
                  {/* Repère de cadrage */}
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                </div>

                {/* Contrôles */}
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-extrabold text-text-main flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" />Zoom</label>
                      <span className="text-xs text-text-muted">{Math.round(zoom * 100)}%</span>
                    </div>
                    <input type="range" min={0.6} max={1.8} step={0.01} value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-[#1CB0F6]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleRemove}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-extrabold transition-all"
                      style={removeBg
                        ? { borderColor: DUO.green, backgroundColor: `${DUO.green}10`, color: DUO.greenDark }
                        : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#9ca3af' }}
                    >
                      {removeBg ? <Wand2 className="h-3.5 w-3.5" /> : <ImageOff className="h-3.5 w-3.5" />}
                      {removeBg ? 'Fond détouré' : 'Fond conservé'}
                    </button>
                    <button
                      onClick={() => { setZoom(1); setOffX(0); setOffY(0); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-xs font-extrabold text-text-muted hover:border-gray-300 transition-all"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Recentrer
                    </button>
                  </div>
                </div>
              </div>

              {/* Aperçu fidèle au site */}
              <div>
                <p className="text-xs font-extrabold text-text-muted uppercase tracking-wider mb-2">Aperçu sur le site</p>
                <div className="mx-auto" style={{ maxWidth: 220 }}>
                  <div
                    className="relative overflow-hidden rounded-2xl"
                    style={{
                      aspectRatio: '3 / 3.4',
                      background: 'linear-gradient(160deg,#edf4ff 0%,#e2edfb 32%,#f2f7ff 58%,#e8f1fc 82%,#eef5ff 100%)',
                      boxShadow: '0 10px 30px rgba(3,4,94,0.12)',
                    }}
                  >
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'contain', objectPosition: 'bottom center' }} />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-10" style={{ background: 'linear-gradient(to top,rgba(245,249,255,0.97) 0%,rgba(245,249,255,0.75) 55%,transparent 100%)' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#03045e', lineHeight: 1.2, margin: '0 0 2px' }}>{displayName || 'Votre nom'}</p>
                      <p style={{ fontSize: '0.6rem', color: '#5a7d95', fontStyle: 'italic', margin: 0 }}>{roleTitle || 'Votre titre'}</p>
                    </div>
                    {!previewUrl && (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-[#0077b6]/40">{initials || '??'}</div>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted text-center mt-2 uppercase tracking-wider font-bold">Carte « Notre Groupe »</p>
                </div>

                {warn && (
                  <div className="mt-4 flex items-start gap-2 text-[11px] text-amber-600 bg-amber-50 rounded-xl p-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> <span>{warn}</span>
                  </div>
                )}
                {error && (
                  <div className="mt-3 flex items-start gap-2 text-[11px] text-red-600 bg-red-50 rounded-xl p-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pied — actions */}
        {(stage === 'edit' || stage === 'uploading') && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => { reset(); }}
              disabled={stage === 'uploading'}
              className="px-4 py-2 rounded-xl text-sm font-extrabold text-text-muted hover:bg-gray-100 transition-all disabled:opacity-40"
            >
              Changer de photo
            </button>
            <button
              onClick={handleApply}
              disabled={stage === 'uploading'}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-extrabold transition-all active:translate-y-[2px] disabled:opacity-60"
              style={{ backgroundColor: DUO.green, boxShadow: `0 3px 0 0 ${DUO.greenDark}` }}
            >
              {stage === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {stage === 'uploading' ? 'Envoi…' : 'Utiliser cette photo'}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
        />
      </div>
    </div>
  );
}
