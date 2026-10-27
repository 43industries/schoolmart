"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function CollectionQrDisplay({ token }: { token: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(token, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!dataUrl) {
    return (
      <p className="break-all rounded-xl bg-brand-surface px-3 py-2 font-mono text-xs text-brand-muted">{token}</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="Collection QR code" className="h-48 w-48 rounded-xl border border-gray-100 bg-white p-2" />
      <p className="max-w-xs break-all font-mono text-[10px] text-brand-muted">{token}</p>
    </div>
  );
}
