type Mesh = { visible: boolean };
type Scene = { getObjectByName: (...args: string[]) => Mesh | null };
type PanelController = { dispose: () => void };

export function revealOfficialBackPanel(scene: Scene): PanelController {
  const overlay = scene.getObjectByName("MnLqboplBegKCiJ");
  if (!overlay) return { dispose: () => undefined };
  const initialVisible = overlay.visible;
  overlay.visible = false;
  return { dispose: () => { overlay.visible = initialVisible; } };
}
