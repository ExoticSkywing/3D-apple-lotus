type StudioLights = {
  group: { visible: boolean; clear: () => void };
  setView: (view: string) => void;
  setColor: (color: string) => void;
  dispose: () => void;
};
type Scene = { add: (...objects: unknown[]) => void; remove: (...objects: unknown[]) => void };

export function createStudioLights(scene: Scene, Three: Record<string, new (...args: never[]) => unknown>): StudioLights {
  const T = Three as unknown as typeof import("three");
  const group = new T.Group();
  group.name = "SingleDeviceStudioLights";

  const ambient = new T.AmbientLight(0xddeeff, 0.8) as import("three").AmbientLight & { lightLayer: number };
  ambient.name = "StudioBodyFill";
  ambient.lightLayer = 1;
  group.add(ambient);

  const key = new T.DirectionalLight(0xfff3e5, 1.1) as import("three").DirectionalLight & { lightLayer: number };
  key.name = "StudioBodyKey";
  key.position.set(-6, 7, 9);
  key.lightLayer = 1;
  group.add(key);
  scene.add(group);

  let currentView = "backLeft";
  let currentColor = "Orange";
  const apply = () => {
    const screenFacing = currentView.startsWith("front");
    const colorBoost = currentColor === "Blue" ? 1.82 : currentColor === "Silver" ? 1.55 : 1;
    ambient.intensity = screenFacing ? 0.22 : 0.8 * colorBoost;
    key.intensity = screenFacing ? 0.34 : 1.1 * colorBoost;
  };
  const setView = (view: string) => { currentView = view; apply(); };
  const setColor = (color: string) => { currentColor = color; apply(); };
  apply();

  return {
    group,
    setView,
    setColor,
    dispose: () => { scene.remove(group); group.clear(); },
  };
}
