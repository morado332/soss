"use client";
import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { btnSecondary, btnSm, cx } from "@/components/ui";

/** Picks an image, downsizes it in the browser (max `size` px) and returns a PNG/WebP data URL (< 300 KB). SVG is not accepted. */
export function ImagePicker({ value, onChange, size = 512, round = false }: { value: string | null; onChange: (v: string | null) => void; size?: number; round?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  async function pick(f: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return alert(t("err_BAD_IMAGE"));
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    let url = c.toDataURL("image/webp", 0.85);
    if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
    if (url.length > 400_000) url = c.toDataURL("image/jpeg", 0.7);
    onChange(url);
  }
  return (
    <div className="flex items-center gap-3">
      <div className={cx("grid h-16 w-16 place-items-center overflow-hidden border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800", round ? "rounded-full" : "rounded-xl")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-slate-400" />}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      <button type="button" onClick={() => ref.current?.click()} className={cx(btnSecondary, btnSm)}><ImagePlus className="h-3.5 w-3.5" />{t("p2_upload")}</button>
      {value && <button type="button" onClick={() => onChange(null)} className={cx(btnSecondary, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>}
    </div>
  );
}
