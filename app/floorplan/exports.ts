import { rasterSize } from "../../packages/floorplan/annotations";
type ViewBounds = { x: number; y: number; width: number; height: number };
export function fileName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "間取り";
}
export function diagramSvg(
  source: SVGSVGElement,
  b: ViewBounds,
  name: string,
  size?: { width: number; height: number },
) {
  const copy = source.cloneNode(true) as SVGSVGElement;
  copy.querySelectorAll("[data-editor-only]").forEach((el) => el.remove());
  copy
    .querySelectorAll('rect[fill="url(#fine-grid)"]')
    .forEach((el) => el.remove());
  copy.setAttribute("viewBox", `${b.x} ${b.y} ${b.width} ${b.height}`);
  copy.setAttribute("width", String(size?.width ?? b.width));
  copy.setAttribute("height", String(size?.height ?? b.height));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    '.room-name{font:500 15px "Yu Gothic UI",Meiryo,sans-serif;fill:#596957;paint-order:stroke;stroke:white;stroke-width:3}.room-area{font:12px sans-serif;fill:#7c8478;paint-order:stroke;stroke:white;stroke-width:3}.dim-label{font:12px sans-serif;fill:#536650;paint-order:stroke;stroke:white;stroke-width:6}.dim-line{stroke:#9aa68e;stroke-width:1}text{font-family:"Yu Gothic UI",Meiryo,sans-serif}';
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = name;
  copy.prepend(style);
  copy.prepend(title);
  return new XMLSerializer().serializeToString(copy);
}
export async function diagramPng(
  source: SVGSVGElement,
  b: ViewBounds,
  name: string,
) {
  const size = rasterSize(b.width, b.height),
    text = diagramSvg(source, b, name, size),
    url = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
    );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("このブラウザでは画像を作成できません。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("画像を作成できませんでした。")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
