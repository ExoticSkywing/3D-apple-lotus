import "./lotus-types";
import { revealOfficialBackPanel } from "./back-panel";
import { createStudioLights } from "./studio-lights";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app")!;

const initialHTML = app.innerHTML;

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const script = document.createElement("script");
  script.src = src;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Unable to load ${src}`));
  document.head.appendChild(script);
});

const isTouch = matchMedia("(pointer: coarse)").matches;
const breakpoint = innerWidth <= 734 ? "S" : innerWidth <= 1068 ? "M" : "L";
const scenePath = `/apple/scenes/iPhone17Pro_US_${breakpoint}_avif.lsd`;

const progress = app.querySelector<HTMLProgressElement>("progress");
const headline = app.querySelector<HTMLElement>(".loading strong");
const percentLabel = app.querySelector<HTMLElement>(".boot-percent");

async function main() {
  await loadScript("/apple/libs/lotus.min.js");
  const Lotus = window.Lotus;
  if (!Lotus) throw new Error("Lotus runtime did not register");

  await loadScript("/apple/scripts/main.runtime.js");
  const appleRequire = window.__APPLE_REQUIRE__;
  if (!appleRequire) throw new Error("Apple module runtime unavailable");
  const initLockScreenChunk = appleRequire("9ec1093ded8c1b4c7ea2").initLockScreenChunk as (() => unknown) | undefined;
  const SceneComponent = (appleRequire("8da07f57fe7c7e20cb3e").default as (new (...args: never[]) => unknown) | undefined) ?? Lotus.Lotus.CustomScene;
  if (!initLockScreenChunk || !SceneComponent) throw new Error("Apple Lotus product viewer modules unavailable");
  Lotus.Lotus.chunks.entries.set("LockScreenChunk", initLockScreenChunk());

  Lotus.instance().settings.initialize({
    FeatureDetect: {
      touchAvailable: () => isTouch,
      webGLAvailable: () => true,
      webGL2Available: () => true,
      safari: false,
      ios: false,
      astc: false,
    },
    UserAgent: (() => {
      const parsed = (appleRequire("c356674424719f1c4ee0").default ?? appleRequire("c356674424719f1c4ee0")) as { browser?: unknown; os?: unknown; mobile?: boolean; tablet?: boolean };
      return parsed?.browser ? parsed : {
        browser: {
          safari: false,
          firefox: false,
          chrome: true,
          edge: false,
          version: { major: 130, minor: 0 },
        },
        os: { ios: false, android: false, macos: false, windows: false, linux: true },
        mobile: isTouch,
        tablet: false,
      };
    })(),
  });
  Lotus.instance().settings.gltfTextureTasks = true;
  Lotus.instance().initialize({ paths: { assets: "/apple/" } });

  const scene = await Lotus.instance().createScene({ component: SceneComponent, element: app.querySelector<HTMLElement>(".product-viewer-canvas")!, url: scenePath });
  const studioLights = createStudioLights(scene as never, (window.Lotus as unknown as { THREE: Record<string, new (...args: never[]) => unknown> }).THREE);
  revealOfficialBackPanel(scene as never);

  const hud = document.createElement("section");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="study-label"><strong>APPLE LOTUS</strong><span>STUDIO LIFT · ${breakpoint}</span></div>
    <div class="view-switch" role="group" aria-label="查看角度">
      <button data-view="front">正面 UI</button><button class="is-active" data-view="backLeft">镜头</button><button data-view="back">背面</button>
    </div>
    <div class="color-switch" role="group" aria-label="机身颜色">
      <button class="swatch orange is-active" data-color="Orange" aria-label="Cosmic Orange"></button>
      <button class="swatch blue" data-color="Blue" aria-label="Deep Blue"></button>
      <button class="swatch silver" data-color="Silver" aria-label="Silver"></button>
    </div>
  `;
  app.appendChild(hud);

  if (scene.camera) scene.camera._fovScale = isTouch ? 1.28 : 1.12;
  const setView = (view: string) => {
    scene.states.set("mode", "ic");
    scene.states.set("angles", view);
    studioLights.setView(view);
    revealOfficialBackPanel(scene as never);
    Lotus.instance().tryRequestAnimationFrame();
    hud.querySelectorAll<HTMLElement>("[data-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.view === view));
  };
  const setColor = (color: string) => {
    scene.states.set("global", color);
    studioLights.setColor(color);
    revealOfficialBackPanel(scene as never);
    Lotus.instance().tryRequestAnimationFrame();
    hud.querySelectorAll<HTMLElement>("[data-color]").forEach((el) => el.classList.toggle("is-active", el.dataset.color === color));
  };
  hud.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.view) setView(button.dataset.view);
    if (button.dataset.color) setColor(button.dataset.color);
  });

  const normalizeProgress = (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(100, Math.max(0, 100 / raw));
  };

  const watch = window.setInterval(() => {
    const rawProgress = scene.loader?.progress ?? 0;
    const percent = scene.rendered ? 100 : normalizeProgress(rawProgress);
    if (progress) progress.value = percent;
    if (percentLabel) percentLabel.textContent = `${Math.round(percent)}%`;
    if (headline) headline.textContent = percent < 100 ? "正在载入官方场景" : "官方场景准备完成";
    if (scene.rendered) {
      clearInterval(watch);
      if (progress) progress.value = 100;
      if (percentLabel) percentLabel.textContent = "100%";
      if (headline) headline.textContent = "官方场景准备完成";
      app.classList.add("is-ready");
      if (scene.camera) scene.camera._fovScale = isTouch ? 1.28 : 1.12;
      setColor("Orange");
      setView("backLeft");
    }
  }, 120);

  window.__LOTUS_STUDY__ = {
    scene,
    setView,
    setColor,
    diagnostics: () => ({ scenePath, breakpoint, isTouch, rendered: scene.rendered, progress: scene.loader?.progress, canvas: Array.from(app.querySelectorAll("canvas")).map((c) => ({ width: c.width, height: c.height, rect: c.getBoundingClientRect().toJSON() })) }),
  };
}

main().catch((error: unknown) => {
  console.error("[apple-lotus-study]", error);
  app.innerHTML = `${initialHTML}<div class="error"><strong>官方场景加载失败</strong><span>${String(error)}</span><button type="button">重试</button></div>`;
});
