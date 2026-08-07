import "./lotus-types";
import { revealOfficialBackPanel } from "./back-panel";
import { createPinchZoom } from "./pinch-zoom";
import { createStudioLights } from "./studio-lights";
import { createWallpaperController, WALLPAPERS } from "./wallpapers";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app")!;

const initialHTML = app.innerHTML;
const SCRIPT_TIMEOUT_MS = 20_000;
const SCENE_CREATE_TIMEOUT_MS = 120_000;
const SCENE_RENDER_TIMEOUT_MS = 120_000;

const progress = app.querySelector<HTMLProgressElement>("progress");
const headline = app.querySelector<HTMLElement>(".loading strong");
const percentLabel = app.querySelector<HTMLElement>(".boot-percent");
const note = app.querySelector<HTMLElement>(".boot-note");

const describeError = (error: unknown) => error instanceof Error ? error.message : String(error);

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
};

const setBootStage = (title: string, detail: string) => {
  if (headline) headline.textContent = title;
  if (percentLabel) percentLabel.textContent = "资源准备中";
  if (note) note.textContent = detail;
  progress?.removeAttribute("value");
};

let bootFailed = false;
const showBootError = (error: unknown) => {
  if (bootFailed || app.classList.contains("is-ready")) return;
  bootFailed = true;
  console.error("[apple-lotus-study]", error);
  const loading = app.querySelector<HTMLElement>(".boot-loading");
  if (!loading) return;
  loading.classList.add("boot-error");
  loading.innerHTML = `
    <div class="boot-card">
      <div class="boot-mark" aria-hidden="true"></div>
      <span class="boot-eyebrow">APPLE LOTUS · RECOVERY</span>
      <strong>官方场景没有完成载入</strong>
      <span class="boot-note">你的操作没有问题。请检查网络后重新加载，页面会从缓存继续。</span>
      <button class="boot-retry" type="button">重新加载</button>
      <details><summary>查看错误信息</summary><code></code></details>
    </div>`;
  loading.querySelector("code")!.textContent = describeError(error);
  loading.querySelector<HTMLButtonElement>(".boot-retry")!.addEventListener("click", () => location.reload());
};

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const script = document.createElement("script");
  script.src = src;
  const timer = window.setTimeout(() => reject(new Error(`Timed out loading ${src}`)), SCRIPT_TIMEOUT_MS);
  script.onload = () => { window.clearTimeout(timer); resolve(); };
  script.onerror = () => { window.clearTimeout(timer); reject(new Error(`Unable to load ${src}`)); };
  document.head.appendChild(script);
});

const isTouch = matchMedia("(pointer: coarse)").matches;
const breakpoint = innerWidth <= 734 ? "S" : innerWidth <= 1068 ? "M" : "L";
const scenePath = `/apple/scenes/iPhone17Pro_US_${breakpoint}_avif.lsd`;

async function main() {
  setBootStage("正在检查官方资源", "首次载入需要下载高精度产品资源");
  const criticalResources = ["/apple/shared/environment.hdr", scenePath];
  const responses = await Promise.all(criticalResources.map((url) => fetch(url)));
  const unavailable = responses.find((response) => !response.ok);
  if (unavailable) throw new Error(`Required resource returned ${unavailable.status}: ${new URL(unavailable.url).pathname}`);

  setBootStage("正在启动官方渲染器", "资源连接正常，正在准备 3D 环境");
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

  setBootStage("正在载入官方场景", "正在下载并解析产品模型，请不要关闭页面");
  const scene = await withTimeout(
    Lotus.instance().createScene({ component: SceneComponent, element: app.querySelector<HTMLElement>(".product-viewer-canvas")!, url: scenePath }),
    SCENE_CREATE_TIMEOUT_MS,
    "Scene initialization timed out",
  );

  const normalizeProgress = (raw: number) => {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(100, Math.max(0, 100 / raw));
  };
  const watch = window.setInterval(() => {
    const percent = scene.rendered ? 100 : normalizeProgress(scene.loader?.progress ?? 0);
    if (progress) progress.value = percent;
    if (percentLabel) percentLabel.textContent = percent > 0 ? `${Math.round(percent)}%` : "正在解析场景";
    if (headline) headline.textContent = percent < 100 ? "正在载入官方场景" : "官方场景准备完成";
  }, 120);

  const studioLights = createStudioLights(scene as never, (window.Lotus as unknown as { THREE: Record<string, new (...args: never[]) => unknown> }).THREE);
  const wallpaperController = await createWallpaperController(scene as never, Lotus.instance(), (window.Lotus as unknown as { THREE: Parameters<typeof createWallpaperController>[2] }).THREE);
  if (!wallpaperController.available) console.warn("[apple-lotus-study] Optional wallpaper controls unavailable; continuing with the native screen state");
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
    <button class="wallpaper-trigger" type="button" aria-label="选择屏幕画面" aria-expanded="false"${wallpaperController.available ? "" : " hidden"}><span>SCREEN</span><i></i></button>
    <div class="wallpaper-panel" role="group" aria-label="屏幕画面预设"${wallpaperController.available ? "" : " hidden"}>
      <span class="wallpaper-caption">SCREEN SCENE</span>
      <div class="wallpaper-options">${WALLPAPERS.map((preset, index) => `<button type="button" class="wallpaper-option${index === 0 ? " is-active" : ""}" data-wallpaper="${preset.id}" aria-label="${preset.label}"><img src="${preset.preview}" alt="" /><span>${preset.label}</span></button>`).join("")}</div>
    </div>
  `;
  app.appendChild(hud);

  if (scene.camera) scene.camera._fovScale = isTouch ? 1.28 : 1.12;
  const pinchZoom = createPinchZoom(app.querySelector<HTMLElement>(".viewer-hit-area")!, scene, Lotus.instance(), isTouch ? 1.28 : 1.12);
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
  const setWallpaper = async (id: string) => {
    await wallpaperController.select(id);
    hud.querySelectorAll<HTMLElement>("[data-wallpaper]").forEach((el) => el.classList.toggle("is-active", el.dataset.wallpaper === id));
    hud.classList.remove("wallpaper-open");
    hud.querySelector<HTMLElement>(".wallpaper-trigger")?.setAttribute("aria-expanded", "false");
  };
  hud.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.view) setView(button.dataset.view);
    if (button.dataset.color) setColor(button.dataset.color);
    if (button.dataset.wallpaper) void setWallpaper(button.dataset.wallpaper);
    if (button.classList.contains("wallpaper-trigger")) {
      const open = hud.classList.toggle("wallpaper-open");
      button.setAttribute("aria-expanded", String(open));
    }
  });

  window.__LOTUS_STUDY__ = {
    scene,
    setView,
    setColor,
    setWallpaper,
    diagnostics: () => ({ scenePath, breakpoint, isTouch, wallpaper: wallpaperController.getCurrent(), wallpaperAvailable: wallpaperController.available, rendered: scene.rendered, progress: scene.loader?.progress, camera: { theta: scene.interactiveCameraScript?.theta, phi: scene.interactiveCameraScript?.phi, fovScale: scene.camera?._fovScale }, canvas: Array.from(app.querySelectorAll("canvas")).map((c) => ({ width: c.width, height: c.height, rect: c.getBoundingClientRect().toJSON() })) }),
  };

  await withTimeout(new Promise<void>((resolve) => {
    const rendered = window.setInterval(() => {
      if (!scene.rendered) return;
      window.clearInterval(rendered);
      resolve();
    }, 120);
  }), SCENE_RENDER_TIMEOUT_MS, "Scene rendering timed out");
  window.clearInterval(watch);
  if (progress) progress.value = 100;
  if (percentLabel) percentLabel.textContent = "100%";
  if (headline) headline.textContent = "官方场景准备完成";
  app.classList.add("is-ready");
  const loading = app.querySelector<HTMLElement>(".boot-loading");
  loading?.setAttribute("aria-hidden", "true");
  loading?.remove();
  if (scene.camera) scene.camera._fovScale = pinchZoom.getScale();
  pinchZoom.apply();
  setColor("Orange");
  setView("backLeft");
}

window.addEventListener("unhandledrejection", (event) => {
  if (app.classList.contains("is-ready")) return;
  event.preventDefault();
  showBootError(event.reason);
});

void initialHTML;
void main().catch(showBootError);
