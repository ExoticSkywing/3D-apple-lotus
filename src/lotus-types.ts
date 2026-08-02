type LotusSceneState = {
  set: (category: string, value: string) => void;
  get?: (category: string) => string;
};

type LotusScene = {
  interactiveCameraScript?: { theta?: number; phi?: number };
  loader?: { progress: number };
  rendered?: boolean;
  camera?: { _fovScale?: number; zoom?: number; updateProjectionMatrix?: () => void };
  states: LotusSceneState;
  renderer?: { domElement?: HTMLCanvasElement };
  render?: () => void;
  destroy?: () => void;
};

type LotusInstance = {
  settings: {
    initialize: (value: Record<string, unknown>) => void;
    gltfTextureTasks: boolean;
  };
  initialize: (value: { paths: { assets: string } }) => void;
  createScene: (value: { component: new (...args: never[]) => unknown; element: HTMLElement; url: string }) => Promise<LotusScene>;
  tryRequestAnimationFrame: () => void;
  addEventListener: (event: string, cb: (...args: unknown[]) => void) => void;
};

type LotusNamespace = {
  instance: () => LotusInstance;
  MobX?: { reaction: (reader: () => unknown, writer: (value: unknown) => void) => { dispose: () => void } };
  Lotus: { chunks: { entries: Map<string, unknown> }; CustomScene?: new (...args: never[]) => unknown };
};

declare global {
  interface Window {
    Lotus?: LotusNamespace;
    __APPLE_REQUIRE__?: (id: string) => Record<string, unknown>;
    __LOTUS_STUDY__?: {
      scene: LotusScene | null;
      setView: (value: string) => void;
      setColor: (value: string) => void;
      diagnostics: () => Record<string, unknown>;
    };
  }
}

export {};
