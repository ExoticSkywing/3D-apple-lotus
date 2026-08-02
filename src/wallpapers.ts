type Texture = { colorSpace?: unknown; needsUpdate?: boolean; dispose?: () => void };
type TextureLoader = { loadAsync: (url: string) => Promise<Texture> };
type LockChunk = { photoMap?: unknown; meshMaterial?: { uniforms?: { map?: { value: Texture } } }; onLoop?: () => void };
type Scene = { eventPool?: { instances?: Array<{ source?: unknown }> }; traverse?: (visitor: (object: { material?: { isLockScreenChunk?: boolean; uniforms?: Record<string, { value?: unknown }> } }) => void) => void };
type Lotus = { tryRequestAnimationFrame: () => void };

export type WallpaperPreset = { id: string; label: string; src: string; preview: string };
export const WALLPAPERS: WallpaperPreset[] = [
  { id: "editorial", label: "Editorial", src: "original", preview: "/wallpapers/editorial.webp" },
  { id: "silk", label: "Silk", src: "/wallpapers/silk.webp", preview: "/wallpapers/silk.webp" },
  { id: "arctic", label: "Arctic", src: "/wallpapers/arctic.webp", preview: "/wallpapers/arctic.webp" },
];

export async function createWallpaperController(scene: Scene, lotus: Lotus, Three: { TextureLoader: new () => TextureLoader; SRGBColorSpace?: unknown }) {
  const chunks = (scene.eventPool?.instances ?? []).map((instance) => (instance as { source?: unknown }).source ?? instance).filter((source): source is LockChunk => !!source && typeof source === "object" && "photoMap" in source && "meshMaterial" in source);
  const screenMaterials: Array<{ uniforms?: Record<string, { value?: unknown }> }> = [];
  scene.traverse?.((object) => { if (object.material?.isLockScreenChunk) screenMaterials.push(object.material); });
  for (let attempt = 0; attempt < 40 && !chunks.length && !screenMaterials.length; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    (scene.eventPool?.instances ?? []).map((instance) => (instance as { source?: unknown }).source ?? instance).filter((source): source is LockChunk => !!source && typeof source === "object" && "photoMap" in source && "meshMaterial" in source).forEach((chunk) => chunks.push(chunk));
    scene.traverse?.((object) => { if (object.material?.isLockScreenChunk && !screenMaterials.includes(object.material)) screenMaterials.push(object.material); });
  }
  const originalBackgrounds = screenMaterials.map((material) => material.uniforms?.backgroundMap?.value as Texture | undefined);
  if (!chunks.length && !screenMaterials.length) throw new Error("LockScreenChunk wallpaper input unavailable");
  const original = chunks.map((chunk) => chunk.meshMaterial?.uniforms?.map?.value);
  const loader = new Three.TextureLoader();
  const loaded = new Map<string, Texture>();
  let current = WALLPAPERS[0].id;
  const select = async (id: string) => {
    const preset = WALLPAPERS.find((item) => item.id === id) ?? WALLPAPERS[0];
    let texture: Texture | undefined;
    if (preset.src !== "original") {
      texture = loaded.get(preset.src) ?? await loader.loadAsync(preset.src);
      if (Three.SRGBColorSpace !== undefined) texture.colorSpace = Three.SRGBColorSpace;
      texture.needsUpdate = true;
      loaded.set(preset.src, texture);
    }
    chunks.forEach((chunk, index) => {
      const map = chunk.meshMaterial?.uniforms?.map;
      if (map) map.value = texture ?? original[index]!;
      chunk.onLoop?.();
    });
    screenMaterials.forEach((material, index) => {
      const map = material.uniforms?.backgroundMap;
      if (map) map.value = texture ?? originalBackgrounds[index];
    });
    current = preset.id;
    lotus.tryRequestAnimationFrame();
    return current;
  };
  return {
    presets: WALLPAPERS,
    select,
    getCurrent: () => current,
    dispose: () => loaded.forEach((texture) => texture.dispose?.()),
  };
}
