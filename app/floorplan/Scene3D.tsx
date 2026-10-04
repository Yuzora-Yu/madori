import { doorPose, shelfBoards } from "../../packages/floorplan/geometry";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  bounds,
  distance,
  projectOnWall,
  rooms,
  type Project,
  type Item,
} from "../../packages/floorplan/model";

export default function Scene3D({
  project,
  cutaway,
}: {
  project: Project;
  cutaway: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() =>
        setError("この環境ではWebGLを利用できません。2D表示をご利用ください。"),
      );
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f2f1ec");
    const box = bounds(project),
      cx = (box.x + box.width / 2) / 100,
      cz = (box.y + box.height / 2) / 100;
    const span = Math.max(box.width, box.height) / 100;
    const camera = new THREE.PerspectiveCamera(
      38,
      1,
      0.1,
      Math.max(500, span * 20),
    );
    camera.position.set(cx + span * 0.65, span * 0.85, cz + span * 0.85);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 0.3, cz);
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 2;
    controls.maxDistance = Math.max(30, span * 4);
    controls.update();
    scene.add(new THREE.HemisphereLight("#fffefa", "#b2b9ac", 1.5));
    const sun = new THREE.DirectionalLight("#fff3db", 2);
    sun.position.set(cx + 8, 16, cz + 6);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -span;
    sun.shadow.camera.right = span;
    sun.shadow.camera.top = span;
    sun.shadow.camera.bottom = -span;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.001;
    scene.add(sun, sun.target);
    const material = (color: string) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const boxMesh = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: string,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(w, 0.01),
          Math.max(h, 0.01),
          Math.max(d, 0.01),
        ),
        material(color),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    boxMesh(
      scene,
      box.width / 100 + 1,
      0.08,
      box.height / 100 + 1,
      cx,
      -0.13,
      cz,
      "#dcded5",
    );
    for (const room of rooms(project)) {
      const shape = new THREE.Shape();
      room.points.forEach((p, i) => {
        if (!i) shape.moveTo(p.x / 100, -p.y / 100);
        else shape.lineTo(p.x / 100, -p.y / 100);
      });
      shape.closePath();
      const floor = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        material("#e3d6bd"),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      // Fine, procedural floor seams; no downloaded textures.
      const minX = Math.min(...room.points.map((p) => p.x)) / 100,
        maxX = Math.max(...room.points.map((p) => p.x)) / 100;
      const minY = Math.min(...room.points.map((p) => p.y)) / 100,
        maxY = Math.max(...room.points.map((p) => p.y)) / 100;
      if (room.points.length === 4)
        for (let z = minY + 0.18; z < maxY; z += 0.18)
          boxMesh(
            scene,
            maxX - minX,
            0.003,
            0.005,
            (minX + maxX) / 2,
            0.003,
            z,
            "#cfc0a4",
          );
    }
    for (const wall of project.walls) {
      const length = distance(wall.a, wall.b) / 100,
        angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
      const group = new THREE.Group();
      group.position.set(wall.a.x / 100, 0, wall.a.y / 100);
      group.rotation.y = -angle;
      scene.add(group);
      const h = cutaway ? Math.min(0.85, wall.height / 100) : wall.height / 100;
      const openings = project.items
        .filter(
          (i) =>
            i.kind &&
            ["door", "sliding", "window"].includes(i.kind) &&
            projectOnWall(i, wall).distance < wall.thickness / 2 + 2 &&
            Math.abs(Math.sin((i.rotation * Math.PI) / 180 - angle)) < 0.02,
        )
        .map((i) => ({
          start: Math.max(0, projectOnWall(i, wall).t * length - i.width / 200),
          end: Math.min(
            length,
            projectOnWall(i, wall).t * length + i.width / 200,
          ),
          item: i,
        }))
        .filter((v) => v.end > v.start)
        .sort((a, b) => a.start - b.start);
      let cursor = 0;
      for (const opening of openings) {
        if (opening.start > cursor)
          boxMesh(
            group,
            opening.start - cursor,
            h,
            wall.thickness / 100,
            (cursor + opening.start) / 2,
            h / 2,
            0,
            "#f5f1e9",
          );
        const low = opening.item.kind === "window" ? Math.min(0.9, h) : 0,
          high = Math.min(h, low + opening.item.height / 100);
        if (low > 0)
          boxMesh(
            group,
            opening.end - opening.start,
            low,
            wall.thickness / 100,
            (opening.start + opening.end) / 2,
            low / 2,
            0,
            "#f5f1e9",
          );
        if (high < h)
          boxMesh(
            group,
            opening.end - opening.start,
            h - high,
            wall.thickness / 100,
            (opening.start + opening.end) / 2,
            (h + high) / 2,
            0,
            "#f5f1e9",
          );
        cursor = Math.max(cursor, opening.end);
      }
      if (cursor < length)
        boxMesh(
          group,
          length - cursor,
          h,
          wall.thickness / 100,
          (cursor + length) / 2,
          h / 2,
          0,
          "#f5f1e9",
        );
    }
    function furniture(item: Item) {
      const group = new THREE.Group();
      group.position.set(
        item.x / 100,
        0.015 + (item.baseElevation ?? 0) / 100,
        item.y / 100,
      );
      group.rotation.y = (-item.rotation * Math.PI) / 180;
      scene.add(group);
      const w = item.width / 100,
        d = item.depth / 100,
        h = item.height / 100,
        c = item.color;
      const add = (
        ww: number,
        hh: number,
        dd: number,
        x: number,
        y: number,
        z: number,
        col = c,
      ) => boxMesh(group, ww, hh, dd, x, y, z, col);
      if (item.kind === "outlet") {
        add(w, 0.12, 0.03, 0, h, 0, "#fff8e9");
        return;
      }
      if (item.kind === "window") {
        if (!cutaway) {
          add(w, 0.04, 0.06, 0, 0.9, 0, "#a4bbb9");
          add(w, 0.04, 0.06, 0, 0.9 + h, 0, "#a4bbb9");
          add(0.04, h, 0.06, 0, 0.9 + h / 2, 0, "#a4bbb9");
          const pane = add(w, h, 0.015, 0, 0.9 + h / 2, 0, "#a6d1d8");
          (pane.material as THREE.MeshStandardMaterial).transparent = true;
          (pane.material as THREE.MeshStandardMaterial).opacity = 0.3;
        }
        return;
      }
      if (item.kind === "door" || item.kind === "sliding") {
        const door = add(
          w,
          cutaway ? 0.7 : h,
          0.04,
          0,
          (cutaway ? 0.7 : h) / 2,
          0,
          c,
        );
        if (item.kind === "door") {
          const pose = doorPose(item);
          door.position.x = pose.center.x / 100;
          door.position.z = pose.center.y / 100;
          door.rotation.y = -pose.angle;
        }
        return;
      }
      if (item.kind === "bath") {
        add(w, 0.12, d, 0, 0.1, 0, "#edf3f2");
        add(0.08, h, d, -w / 2, h / 2, 0);
        add(0.08, h, d, w / 2, h / 2, 0);
        add(w, h, 0.08, 0, h / 2, -d / 2);
        add(w, h, 0.08, 0, h / 2, d / 2);
        return;
      }
      if (item.kind === "toilet") {
        add(w, 0.38, d * 0.65, 0, 0.2, d * 0.12, "#fafbf8");
        add(w, h, d * 0.23, 0, h / 2, -d * 0.35, "#e1e9e6");
        return;
      }
      if (item.shape === "shelf") {
        const boards = shelfBoards(item),
          t = boards.thickness / 100;
        add(t, h, d, -w / 2 + t / 2, h / 2, 0);
        add(t, h, d, w / 2 - t / 2, h / 2, 0);
        add(w, h, t, 0, h / 2, -d / 2 + t / 2);
        boards.heights.forEach((y) =>
          add(w - 2 * t, t, d - t, 0, y / 100, t / 2),
        );
      } else if (item.shape === "sofa") {
        add(w, 0.22, d, 0, 0.22, 0);
        add(w, h * 0.65, 0.16, 0, h * 0.65, -d / 2 + 0.08);
        for (const x of [-w / 2 + 0.08, w / 2 - 0.08])
          add(0.16, h * 0.65, d, x, h * 0.45, 0);
        for (const x of [-w / 4, w / 4])
          add(w / 2 - 0.2, 0.12, d - 0.22, x, 0.39, 0.05, "#9fbaa6");
      } else if (item.shape === "bed") {
        add(w, 0.22, d, 0, 0.15, 0, "#a79073");
        add(w, 0.22, d - 0.08, 0, 0.37, 0, "#f4f0e6");
        add(w, 0.8, 0.08, 0, 0.4, -d / 2, "#b6a289");
        add(w, 0.07, d * 0.55, 0, 0.5, d * 0.2, c);
        for (const x of [-w / 4, w / 4])
          add(w / 2 - 0.08, 0.1, 0.35, x, 0.52, -d * 0.3, "#faf8f3");
      } else if (item.shape === "table") {
        add(w, 0.07, d, 0, h, 0);
        for (const x of [-w / 2 + 0.08, w / 2 - 0.08])
          for (const z of [-d / 2 + 0.08, d / 2 - 0.08])
            add(0.06, h, 0.06, x, h / 2, z, "#8c7a62");
      } else if (item.shape === "plant") {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.28, w * 0.21, h * 0.3, 16),
          material("#c3a58b"),
        );
        pot.position.y = h * 0.15;
        group.add(pot);
        for (const x of [-w * 0.2, 0, w * 0.2]) {
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(w * 0.36, 12, 10),
            material(c),
          );
          leaf.scale.set(0.8, 1.5, 0.8);
          leaf.position.set(x, h * 0.65, 0);
          leaf.castShadow = true;
          group.add(leaf);
        }
      } else {
        add(w, h, d, 0, h / 2, 0);
        if (item.shape === "storage" || item.shape === "appliance") {
          add(w * 0.94, 0.012, 0.016, 0, h * 0.65, d / 2 + 0.008, "#78857c");
          add(
            0.025,
            h * 0.2,
            0.025,
            w * 0.3,
            h * 0.45,
            d / 2 + 0.02,
            "#63746b",
          );
        }
      }
    }
    project.items.forEach(furniture);
    let frame = 0;
    const render = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => renderer.render(scene, camera));
    };
    controls.addEventListener("change", render);
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const lost = (e: Event) => {
      e.preventDefault();
      setError("3D描画が中断しました。2Dに切り替えてから再度お試しください。");
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [project, cutaway]);
  return (
    <div className="scene3d" ref={host}>
      {error && <div className="scene-error">{error}</div>}
      <div className="orbit-hint">
        ドラッグで回転 · ホイールで拡大 · 右ドラッグで移動
      </div>
    </div>
  );
}
