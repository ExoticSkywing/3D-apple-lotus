type Camera = { zoom?: number; updateProjectionMatrix?: () => void };
type Scene = { camera?: Camera };
type Lotus = { tryRequestAnimationFrame: () => void };

type PinchController = { getScale: () => number; apply: () => void; dispose: () => void };

export function createPinchZoom(target: HTMLElement, scene: Scene, lotus: Lotus, initialScale: number): PinchController {
  let scale = initialScale;
  let zoom = 1;
  let startDistance = 0;
  let startScale = initialScale;
  const distance = (touches: TouchList) => {
    const a = touches[0]; const b = touches[1];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };
  const apply = (next: number) => {
    scale = Math.min(1.75, Math.max(0.72, next));
    zoom = initialScale / scale;
    if (scene.camera) {
      scene.camera.zoom = zoom;
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
    if (startDistance === 0 && scene.camera && Math.abs((scene.camera.zoom ?? 1) - zoom) > 0.001) {
      scene.camera.zoom = zoom;
      scene.camera.updateProjectionMatrix?.();
      lotus.tryRequestAnimationFrame();
    }
  }, 80);
  target.addEventListener("touchstart", onStart, { passive: false });
  target.addEventListener("touchmove", onMove, { passive: false });
  target.addEventListener("touchend", onEnd, { passive: true });
  target.addEventListener("touchcancel", onEnd, { passive: true });
  apply(initialScale);
  return {
    getScale: () => scale,
    apply: () => apply(scale),
    dispose: () => {
      clearInterval(maintain);
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchmove", onMove);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onEnd);
    },
  };
}
