import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icons";
export default function PrintPreview({
  svg,
  name,
  landscape: initial,
  onClose,
}: {
  svg: string;
  name: string;
  landscape: boolean;
  onClose: () => void;
}) {
  const [landscape, setLandscape] = useState(initial),
    [ready, setReady] = useState(false);
  const host = useRef<HTMLElement>(null);
  const src = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    host.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const list = Array.from(
            host.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? [],
          ),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => {
      window.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <>
      <div className="modal-backdrop print-preview-backdrop">
        <section
          className="modal print-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-title"
          ref={host}
        >
          <div className="print-preview-header">
            <h2 id="print-title">A4印刷プレビュー</h2>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="印刷プレビューを閉じる"
            >
              <Icon name="close" />
            </button>
          </div>
          <p>
            図面全体をA4用紙1枚に収めます。印刷ダイアログでも用紙をA4、向きを同じ設定にしてください。PDFとして保存することもできます。
          </p>
          <div className="print-preview-actions">
            <div className="view-switch">
              <button
                aria-pressed={!landscape}
                className={!landscape ? "active" : ""}
                onClick={() => setLandscape(false)}
              >
                A4 縦
              </button>
              <button
                aria-pressed={landscape}
                className={landscape ? "active" : ""}
                onClick={() => setLandscape(true)}
              >
                A4 横
              </button>
            </div>
            <button
              className="primary-button"
              disabled={!ready}
              onClick={() => window.print()}
            >
              <Icon name="print" size={18} />
              印刷する
            </button>
          </div>
          <div className={`print-paper ${landscape ? "landscape" : ""}`}>
            <h3>{name}</h3>
            <img
              src={src}
              alt="印刷する間取り図"
              onLoad={() => setReady(true)}
            />
          </div>
        </section>
      </div>
      <section
        className={`print-sheet ${landscape ? "landscape" : ""}`}
        aria-hidden="true"
      >
        <h1>{name}</h1>
        <img src={src} alt="間取り図" />
      </section>
      <style media="print">{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; }`}</style>
    </>,
    document.body,
  );
}
