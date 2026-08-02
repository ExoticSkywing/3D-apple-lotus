type Camera = { _fovScale?: number; zoom?: number; updateProjectionMatrix?: () => void };
type Scene = { camera?: Camera };
type Lotus = { tryRequestAnimationFrame: () => void };

type PinchController = { getScale: () => number; apply: () => void; dispose: () => void };

export function createPinchZoom(target: HTMLElement, scene: Scene, lotus: Lotus, initialScale: number): PinchController {
  let scale = initialScale;
  let startDistance = 0;
  let startScale = initialScale;
  const distance = (touches: TouchList) => {
    const a = touches[0]; const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };
  const apply = (next: number) => {
    scale = Math.min(1.75, Math.max(0.72, next));
    if (scene.camera) {
      scene.camera._fovScale = scale;
      scene.camera.zoom = 1;
      scene.camera.updateProjectionMatrix?.();
    }
    lotus.tryRequestAnimationFrame();
  };
  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    startDistance = distance(event.touches);
    startScale = scale;
  };
  const onMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || startDistance <= 0) return;
    event.preventDefault();
    apply(startScale / (distance(event.touches) / startDistance));
  };
  const onEnd = (event: TouchEvent) => { if (event.touches.length < 2) startDistance = 0; };
  const maintain = window.setInterval(() => {
    if (startDistance === 0 && scene.camera && Math.abs((scene.camera._fovScale ?? initialScale) - scale) > 0.001) {
      scene.camera._fovScale = scale;
      scene.camera.zoom = 1;
      scene.camera.updateProjectionMatrix?.();
      lotus.tryRequestAnimationFrame();
    }
  }, 80);
  target.addEventListener("touchstart", onStart, { passive: false });
  window.addEventListener("touchstart", onStart, { passive: false, capture: true });
  target.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false, capture: true });
  target.addEventListener("touchend", onEnd, { passive: true });
  window.addEventListener("touchend", onEnd, { passive: true, capture: true });
  target.addEventListener("touchcancel", onEnd, { passive: true });
  apply(initialScale);
  return {
    getScale: () => scale,
    apply: () => apply(scale),
    dispose: () => {
      clearInterval(maintain);
      target.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchstart", onStart, true);
      target.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchmove", onMove, true);
      target.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchend", onEnd, true);
      target.removeEventListener("touchcancel", onEnd);
    },
  };
}
