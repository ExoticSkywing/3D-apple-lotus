## 结论

- **[SOURCE] Lotus 可以脱离 Apple 页面控制器独立启动。** 最小链路是：加载 `lotus.min.js` → 注册 `LockScreenChunk` → 初始化 Settings → `Lotus.initialize({paths})` → `createScene({element,url})`。
- **[SOURCE] `LockScreenChunk` 不是 Lotus 内置 chunk。** 它由 Apple 的 `main.built.js` 在 Lotus 加载后、场景组件反序列化前动态写入：
  ```js
  const ChunkClass = initLockScreenChunk()
  window.Lotus.Lotus.chunks.entries.set("LockScreenChunk", ChunkClass)
  ```
- **[SOURCE] 独立页面完全不需要执行 Apple 的 `main.built.js`。** 只需从其中提取 4 个模块，改写成普通 ESM：
  1. LockScreenChunk 类；
  2. 注入到材质的两个 fragment shader chunk；
  3. photo/depth MRT 的 vertex/fragment shader；
  4. 一个 quadratic easing 实现。
- **[SOURCE] 六个 L/M/S × AVIF/KTX 根场景的 LockScreenChunk 参数完全一致。**
- **[SOURCE] 本次只读调查，没有创建或修改任何项目文件。**

---

# 1. 证据位置

由于下载的 `main.built.js` 几乎全部压在物理第 1 行，**行号没有区分能力，以下使用零基字节区间 `[start,end)` 和 webpack module ID**。

文件：

```text
/root/.hermes/profiles/frontend/workspace/apple-lotus-study/source-mirror/apple/scripts/main.built.js
```

| 内容 | webpack module | 字节区间 |
|---|---:|---:|
| photo/depth MRT vertex + fragment shader | `8dd444d1bac34626b6bd` | `[349291,350445)` |
| `LockScreenChunk` 类及全部 fields | `9ec1093ded8c1b4c7ea2` | `[449949,462162)` |
| GUI Vector 辅助，仅调试 GUI 需要 | `ac60c11e5127d6f99532` | `[524155,524993)` |
| Apple 动态加载 Lotus、注册 chunk、创建场景 | `d9dfd050099c62742a9d` | `[602340,604697)` |
| Liquid Glass `commonFragment` / `emissivemapFragment` | `f21356d1f668059650f8` | `[656787,662155)` |
| easing 集合；运行时只实际使用 `quad` | `76e3cc0d07f33056bdcc` | `[304113,307823)` |
| Apple ProductViewer Lotus 初始化/场景加载 | `4cd6425c3598fa062d9c` | `[242387,247225)` |
| Apple 自定义 `CustomScene` | `8da07f57fe7c7e20cb3e` | `[343249,349291)` |

其他关键位置：

```text
source-mirror/apple/page.html
  1157       外层 product-viewer-component/data-library-path
  1172 起    data-product-viewer-id、data-rt-* 属性

source-mirror/apple/scenes/iPhone17Pro_US_L_avif.lsd
  3          根 @variants
  5–30       photoMesh/photoMap/iconsMap/clockMap 资产
  1831–1888  pkUBCyCvYJYVzTr / LockScreenChunk
  2111–2140  configuration + renderer
  2142–2214  可用 states
```

---

# 2. Apple 原始初始化顺序

## 2.1 ProductViewer 侧的 Lotus 初始化

`main.built.js` module `4cd6425c3598fa062d9c` 的核心逻辑：

```js
this.Lotus.instance().settings.initialize({
  FeatureDetect,
  UserAgent,
})

this.Lotus.instance().settings.gltfTextureTasks = true

this.Lotus.instance().initialize({
  paths: {
    assets: this.DEFAULT_PATH,
  },
})

this.scene = await this.Lotus.instance().createScene({
  component: this.sceneComponent,
  element: this.element,
  url: this.scenePath,
})
```

场景选择逻辑：

```js
let scene = SCENES.large

if (FeatureDetect.touchAvailable()) {
  scene = window.outerWidth <= 884
    ? SCENES.small
    : SCENES.medium
}

const astc = document
  .createElement("canvas")
  .getContext("webgl2")
  .getExtension("WEBGL_compressed_texture_astc")

scene += astc ? "_ktx" : "_avif"

scenePath = `${DEFAULT_PATH}/scenes/${scene}.lsd`
```

Apple 设置 `settings.gltfTextureTasks = true` 是优化项；不是 API 结构上的硬性要求，但为最大兼容原场景建议保留。

## 2.2 LockScreenChunk 的注册时点

module `d9dfd050099c62742a9d` 中的原始关键逻辑：

```js
class AppleProductScene extends BaseAppleScene {
  init() {
    const ChunkClass = initLockScreenChunk()

    window.Lotus.Lotus.chunks.entries.set(
      "LockScreenChunk",
      ChunkClass,
    )

    return super.init()
  }
}
```

这说明注册必须发生在：

```text
Lotus UMD 已加载
    ↓
LockScreenChunk class 已生成并注册
    ↓
CustomScene.super.init()
    ↓
components/material chunks 反序列化
```

**不能等到 `scene.rendered` 后再注册**，因为此时材质 chunk 已经创建。

---

# 3. 不依赖 Apple main.built.js 的注册方案

推荐将提取结果整理为：

```text
src/lotus-lock-screen/
  LockScreenChunk.ts
  lockScreenFragments.ts
  photoDepthShaders.ts
  quadraticEase.ts
```

`LockScreenChunk.ts` 只从 `window.Lotus` 获取依赖，不引用 Apple webpack loader。

## 3.1 注册 API

```ts
declare global {
  interface Window {
    Lotus: any
  }
}

import { initLockScreenChunk } from "./lotus-lock-screen/LockScreenChunk"

const LotusAPI = window.Lotus
const lotus = LotusAPI.instance()

const LockScreenChunk = initLockScreenChunk()

// 最直接，与 Apple 完全相同：
lotus.chunks.entries.set("LockScreenChunk", LockScreenChunk)
```

也可在 Lotus registry 尚未初始化时一次性注入：

```ts
lotus.chunks.initialize({
  LockScreenChunk,
})
```

但为了与 Apple 行为一致、避免依赖 `isInitialized` 状态，建议：

```ts
lotus.chunks.entries.set("LockScreenChunk", LockScreenChunk)
```

然后正常调用 `lotus.initialize()`；内置 chunks 初始化不会删除这个额外键。

**注册 key 必须准确为 `"LockScreenChunk"`**。场景 JSON 就以这个字符串查找构造器。

## 3.2 独立 Vite 最小启动代码

`lotus.min.js` 是 UMD，不要把它当标准 ESM 导入。可在 HTML 中使用 classic script：

```html
<div id="lotus-host"></div>
<script src="/apple/libs/lotus.min.js"></script>
<script type="module" src="/src/main.ts"></script>
```

最小 `main.ts`：

```ts
import { initLockScreenChunk } from "./lotus-lock-screen/LockScreenChunk"

const host = document.querySelector<HTMLElement>("#lotus-host")!

// host 必须具有非零尺寸
Object.assign(host.style, {
  width: "100%",
  height: "100vh",
  position: "relative",
  overflow: "hidden",
})

const L = window.Lotus
const lotus = L.instance()

// 必须在 createScene/components 反序列化前注册
const LockScreenChunk = initLockScreenChunk()
lotus.chunks.entries.set("LockScreenChunk", LockScreenChunk)

const safariMatch = navigator.userAgent.match(/Version\/(\d+)\.(\d+)/)
const firefox = /Firefox\//.test(navigator.userAgent)
const safari =
  /Safari\//.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent)

const FeatureDetect = {
  touchAvailable: () =>
    navigator.maxTouchPoints > 0 || "ontouchstart" in window,
}

const UserAgent = {
  browser: {
    safari,
    firefox,
    version: {
      major: Number(safariMatch?.[1] ?? 0),
      minor: Number(safariMatch?.[2] ?? 0),
    },
  },
  os: {
    ios: /iPhone|iPad|iPod/.test(navigator.userAgent),
  },
}

lotus.settings.initialize({
  FeatureDetect,
  UserAgent,
})

lotus.settings.gltfTextureTasks = true

await lotus.initialize({
  // 原 LSD 的资产路径均以 /uploads/... 开始：
  // "/apple" + "/uploads/..." => "/apple/uploads/..."
  paths: {
    assets: "/apple",
  },
})

const scene = await lotus.createScene({
  element: host,
  url: "/apple/scenes/iPhone17Pro_US_L_avif.lsd",
})

// scene 初始化后启用 RAF
lotus.tryRequestAnimationFrame()

// rendered 是 observable；需要加载完成通知时：
const disposeRendered = L.MobX.reaction(
  () => scene.rendered,
  (rendered: boolean) => {
    if (!rendered) return
    console.log("Lotus scene rendered")
    disposeRendered()
  },
)
```

AVIF 是最简单的固定选择。如果需要复现 Apple 自动选择：

```ts
const gl = document.createElement("canvas").getContext("webgl2")
const astc = gl?.getExtension("WEBGL_compressed_texture_astc")
const suffix = astc ? "ktx" : "avif"

const sceneURL =
  `/apple/scenes/iPhone17Pro_US_L_${suffix}.lsd`
```

---

# 4. LockScreenChunk 最小模块逻辑

## 4.1 Shader 注入点

Chunk 构造时传给 `Lotus.Chunk` 的两条 instruction：

```ts
super({
  component,
  data,
  material,
  name: "LockScreenChunk",
  instructions: [
    {
      target: L.ChunkInstructionTarget.FragmentShader,
      type: L.ChunkInstructionType.Replace,
      token: "#include <common>",
      chunk: commonFragment,
    },
    {
      target: L.ChunkInstructionTarget.FragmentShader,
      type: L.ChunkInstructionType.Replace,
      token: "#include <emissivemap_fragment>",
      chunk: emissivemapFragment,
    },
  ],
})
```

Lotus 枚举值经 live runtime 验证：

```ts
ChunkInstructionTarget = {
  VertexShader: 0,
  FragmentShader: 1,
}

ChunkInstructionType = {
  InjectBefore: 0,
  Replace: 1,
  InjectAfter: 2,
}
```

`Lotus.Chunk.createInstructions()` 会：

1. 将原 Three 材质转成 `InjectableMaterial`；
2. 取对应 `THREE.ShaderLib` shader；
3. 替换上述两个 token；
4. 设置 `material.isLockScreenChunk = true`；
5. 由 `ChunkUniforms` 把字段转换为 Texture、Color、Vector 等并写入材质 uniforms。

## 4.2 本地 ESM initializer 外形

```ts
import {
  commonFragment,
  emissivemapFragment,
} from "./lockScreenFragments"

import {
  photoDepthVertex,
  photoDepthFragment,
} from "./photoDepthShaders"

import { quadEaseInOut } from "./quadraticEase"

export function initLockScreenChunk() {
  const L = window.Lotus
  const lotus = L.Lotus
  const THREE = L.THREE

  class LockScreenChunk extends L.Chunk {
    // 此处逐字迁移 module 9ec109... 中的 constructor、
    // setElementReady、onLoop、createGUI 等。
  }

  LockScreenChunk.fields = {
    ...L.ChunkFields,
    // 完整 fields 见下一节
    ...L.TimelineFields,
  }

  return LockScreenChunk
}
```

Apple 模块导入依赖的替换方式：

| Apple module | 独立实现 |
|---|---|
| `76e3...` | 只保留 quadratic `easeInOut` |
| `ac60...` | 仅 GUI 使用；生产实现可移除 `createGUI()` |
| `8dd4...` | 复制两个 shader string 为 ESM 常量 |
| `f213...` | 复制两个 fragment string 为 ESM 常量 |
| `92ff...` | Babel interop helper，改写成 ESM 后完全不需要 |
| `99f5...` | lil-gui，只被 `?gui` 调试路径使用，不需要 |

Quadratic easing 的等价最小实现：

```ts
export function quadEaseInOut(
  elapsed: number,
  start = 0,
  change = 1,
  duration = 1,
) {
  let t = elapsed / (duration / 2)

  if (t < 1) {
    return (change / 2) * t * t + start
  }

  t -= 1
  return (-change / 2) * (t * (t - 2) - 1) + start
}
```

Apple 实际调用：

```js
quad.easeInOut(value + 1, -1, 2, 2)
```

## 4.3 内部 render-to-texture 过程

`LockScreenChunk` 并非一张平面截图，构造器创建：

```ts
new THREE.WebGLRenderTarget(
  475 * devicePixelRatio,
  1024 * devicePixelRatio,
  { count: 2 },
)
```

附件：

```text
textures[0]  colorTexture  RGBAFormat
textures[1]  depthTexture  RedFormat
```

内部 camera：

```ts
new THREE.PerspectiveCamera(
  fov,
  renderTarget.width / renderTarget.height,
  0.01,
  2000,
)
```

内部 `photoMesh` 使用独立 GLSL3 `ShaderMaterial`：

```ts
uniforms: {
  map:        { value: null },
  focalPoint: { value: Math.abs(camera.position.z) },
  near:       { value: camera.near }, // 0.01
  far:        { value: camera.far },  // 2000
}
```

每帧核心顺序：

```ts
// 由当前产品相机位置算球坐标和 phone rotation
spherical.setFromVector3(activeCamera.position)

// phoneAngleMax -> photoAngleMax 映射并 easing
cameraTarget.rotation.x = orbit.y
cameraTarget.rotation.y = orbit.x

uniforms.lightOffset.value = [
  10 * cameraTarget.rotation.y,
  -10 * cameraTarget.rotation.y,
]

// resetToCenter 时逐帧衰减
orbitVelocity.multiplyScalar(1 - resetSpeed)

// 先渲染 wallpaper/photo mesh 到 MRT
renderer.setRenderTarget(renderTarget)
renderer.render(internalScene, internalCamera)
renderer.setRenderTarget(null)

// 随后主材质 fragment 使用 color + depth + icons + clock
```

---

# 5. 所有 LockScreenChunk 字段默认值

以下来自 live runtime 的 `initLockScreenChunk().fields`，并与本地 module `9ec109...` 末尾 fields 声明交叉验证。

## 5.1 继承字段

| 字段 | 默认值 | 类型 |
|---|---:|---|
| `@animations` | `""` | `File` |
| `@variants` | `""` | `File` |
| `id` | `""` | `String`，不可编辑 |
| `transition` | `"keyframes"` | `Select`：`keyframes` / `interpolation` |

## 5.2 Asset 字段

| 字段 | 默认值 | 类型/过滤 |
|---|---:|---|
| `photoMesh` | `""` | `Asset:model` |
| `photoMap` | `""` | `Asset:texture` |
| `iconsMap` | `""` | `Asset:texture` |
| `clockMap` | `""` | `Asset:texture` |

## 5.3 Camera/rotation 字段

| 字段 | 默认值 | min | max | step |
|---|---:|---:|---:|---:|
| `fov` | `65` | 10 | 100 | 1 |
| `target` | `-2.7` | -20 | 0 | .001 |
| `zoom` | `1.1` | 1 | 1.5 | .01 |
| `photoAngleMax` | `3` | 0 | 180 | .1 |
| `phoneAngleMax` | `70` | 0 | 180 | .1 |
| `resetSpeed` | `.02` | 0 | .05 | .001 |
| `resetToCenter` | `true` | — | — | Boolean |

## 5.4 UI/Glass 字段

| 字段 | 默认值 | 范围 |
|---|---:|---|
| `clockColor` | `[1,1,1]` | Vector |
| `clockTint` | `1` | 0..1, step .001 |
| `uiColor` | `[1,1,1]` | Vector |
| `ambientColor` | `[1,1,1]` | Vector |
| `buttonColor` | `[1,1,1]` | Vector |
| `tintDate` | `false` | Boolean |
| `showTarget` | `false` | Boolean |
| `showTexture` | `false` | Boolean |
| `rimSize` | `.02` | 0..0.1, step .001 |
| `glassMin` | `.44` | .4..5, step .001 |
| `glassMax` | `.55` | .5..6, step .001 |
| `glassFactor` | `.7` | 0..1, step .001 |
| `glassOffset` | `.09` | 0..2, step .001 |
| `glassBlur` | `4` | 0..10, step .1 |

此外构造器中有一个**未暴露为 field** 的 shader uniform：

```ts
useBlur = true
```

---

# 6. 官方场景实际覆盖值

材质：

```text
material ID: pkUBCyCvYJYVzTr
scene JSON: children[10].children[0].materials.pkUBCyCvYJYVzTr
```

官方原始 chunk 数据：

```json
{
  "@animations": "",
  "@variants": "",
  "ambientColor": [1, 1, 1],
  "buttonColor": [1, 1, 1],
  "clockColor": [1, 1, 1],
  "clockMap": "lljgXVbJQkkYJmM",
  "clockTint": 1,
  "fov": 65,
  "iconsMap": "uvCChzbGHciFMRB",
  "id": "16c83e3e-ec3b-4210-8958-6f206152fa5c",
  "phoneAngleMax": 70,
  "photoAngleMax": 6,
  "photoMap": "ElNHawndyjfllPP",
  "photoMesh": "NwunHPHkyZOcfLy",
  "resetSpeed": 0.02,
  "resetToCenter": false,
  "showTarget": false,
  "showTexture": false,
  "target": -2.5,
  "transition": "interpolation",
  "uiColor": [1, 1, 1],
  "zoom": 1.05
}
```

相对 class 默认值的有效覆盖：

| 字段 | class 默认 | 官方场景 |
|---|---:|---:|
| `target` | -2.7 | **-2.5** |
| `zoom` | 1.1 | **1.05** |
| `photoAngleMax` | 3 | **6** |
| `resetToCenter` | true | **false** |
| `transition` | keyframes | **interpolation** |

`rimSize/glassMin/glassMax/glassFactor/glassOffset/glassBlur/tintDate` 未写入根场景 chunk，因此使用 chunk 默认配置。

---

# 7. Shader uniform 清单

## 7.1 注入主产品材质的 uniforms

`f21356d1f668059650f8.commonFragment` 声明：

```glsl
uniform sampler2D backgroundMap;
uniform sampler2D iconsMapTexture;
uniform sampler2D clockMapTexture;
uniform sampler2D depthMap;

uniform vec2 lightOffset;
uniform vec3 clockColor;
uniform float clockTint;
uniform vec3 buttonColor;
uniform bool tintDate;
uniform vec3 uiColor;
uniform vec3 ambientColor;
uniform bool useBlur;
uniform float rimSize;
uniform float glassMin;
uniform float glassMax;
uniform float glassFactor;
uniform float glassOffset;
uniform float glassBlur;
```

对应构造器初值：

```ts
{
  backgroundMap:       renderTarget.textures[0],
  depthMap:            renderTarget.textures[1],
  iconsMapTexture:     new THREE.Texture(document.createElement("canvas")),
  clockMapTexture:     new THREE.Texture(document.createElement("canvas")),
  lightOffset:         [0, 0],
  clockColor:          THREE.Color(0xffffff),
  clockTint:           1,
  buttonColor:         THREE.Color(0xffffff),
  tintDate:            false,
  uiColor:             THREE.Color(0xffffff),
  ambientColor:        THREE.Color(0xffffff),
  useBlur:             true,
  rimSize:             0.02,
  glassMin:            0.44,
  glassMax:            0.55,
  glassFactor:         0.7,
  glassOffset:         0.09,
  glassBlur:           4,
}
```

Shader 字符串长度，经 live 模块读取：

```text
commonFragment       2102 chars
emissivemapFragment  2905 chars
photoDepthVertex      381 chars
photoDepthFragment    565 chars
```

应从上述模块逐字迁移，避免手工重写 Liquid Glass 数学逻辑。

## 7.2 Asset 绑定

| Scene ID | 语义 | 文件 |
|---|---|---|
| `NwunHPHkyZOcfLy` | `photoMesh` | `KvTAbGmpcucJaqb.glb` |
| `ElNHawndyjfllPP` | `photoMap` | `CHtvnoYUCoGYykb.avif` |
| `uvCChzbGHciFMRB` | `iconsMap` | `uqQWMrYNHBqquCW.avif` |
| `lljgXVbJQkkYJmM` | `clockMap` | `xDQjWMvPKWRtFLK.webp` |

`clockMap` 的 texture properties：

```json
{
  "channel": 0,
  "colorSpace": "srgb-linear",
  "flipY": true,
  "wrapS": 1000,
  "wrapT": 1000
}
```

LockScreenChunk 通过：

```ts
Lotus.Assets.getAssetPromise(this.photoMesh)
Lotus.Assets.getAssetPromise(this.photoMap)
Lotus.Assets.getAssetPromise(this.iconsMap)
Lotus.Assets.getAssetPromise(this.clockMap)
```

解析这些 ID。四项全部 ready 后才将所属 component 标记 `fileReady`。

---

# 8. DOM data 属性

## 8.1 独立直接调用 API 时

如果采用前面的直接 `createScene()` 方案，**Lotus 本身不要求任何 `data-*` 属性**。只需要：

```html
<div id="lotus-host"></div>
```

并由 JS 显式传：

```ts
{
  element: host,
  url: sceneURL
}
```

## 8.2 若要复刻 Apple ProductViewer 包装层

外层，`page.html:1157`：

```html
<div
  class="product-viewer-component"
  data-component-list="ProductViewerCore ProductViewer ProductViewerSmall CustomProductScene"
  data-library-path="/apple/libs/lotus.min.js"
  data-mode="3d"
>
```

其中 `CustomProductScene.onViewerTriggerLoad()` 实际使用：

```js
this.el.dataset.libraryPath
```

所以这里需要的是 **`data-library-path`**，不是仅仅 `data-rt-library-path`。

内层，`page.html:1172`：

```html
<div
  id="product-gallery"
  data-product-viewer-id="product-gallery"
  data-rt-library-path="/apple/libs/lotus.min.js"
  data-rt-scenes-path="/apple/"
  data-rt-scenes='{
    "large": "iPhone17Pro_US_L",
    "medium": "iPhone17Pro_US_M",
    "small": "iPhone17Pro_US_S"
  }'
  data-rt-states="{}"
  data-rt-analytics="{}"
  data-matching-angles='[
    {
      "ptAngle": "PT_backLeft",
      "interactiveAngle": "backLeft"
    }
  ]'
  data-pt-big='["PT_backLeft"]'
  data-pt-smol='["PT_backLeft"]'
>
  <div class="product-viewer-canvas"></div>
  <div class="viewer-hit-area"></div>
  <div class="loader">
    <div class="loader-progress-indicator"></div>
    <div class="preview-image"></div>
  </div>
</div>
```

必需性区分：

| 属性/节点 | Apple wrapper | 直接 API |
|---|---:|---:|
| `data-library-path` | 必需 | 不需要 |
| `data-product-viewer-id` | 必需，singleton selector | 不需要 |
| `data-rt-scenes-path` | 必需 | 不需要 |
| `data-rt-scenes` | 必需 | 不需要 |
| `data-rt-states` | 可选，默认 `{}` | 不需要 |
| `data-rt-analytics` | Apple 代码直接解析，建议 `{}` | 不需要 |
| `data-matching-angles` | Apple CustomScene 需要 | 不需要 |
| `data-pt-big/smol` | Apple CustomScene 需要 | 不需要 |
| `.viewer-hit-area` | Apple 将 pointer listener 改绑到它 | 不需要 |
| `.loader-progress-indicator` | Apple loader UI | 不需要 |

---

# 9. `scene.states` API

Live Lotus runtime 暴露：

```ts
scene.states.get(category)
scene.states.set(category, state)
scene.states.bind(category, callback)
scene.states.bindAll(callback)
scene.states.categories
scene.changeState(category, state) // 转发给 states.set
```

行为：

```js
get(category) {
  return this.states[category]
}

set(category, state) {
  this.states[category] = state
  this.onBindingsChange(category, state)
}

bind(category, callback) {
  return this.observe(
    this.states,
    category,
    change => callback(change, category),
    true,
  )
}

bindAll(callback) {
  return Object.keys(this.categories).map(category =>
    this.observe(
      this.states,
      category,
      change => callback(change, category),
      true,
    ),
  )
}
```

状态变更也会触发：

```text
scene.eventPool event name: "stateChange"

payload:
{
  category,
  oldValue,
  newValue
}
```

根场景默认值：

```ts
scene.states.get("angles") // "backLeft"
scene.states.get("global") // "Orange"
scene.states.get("mode")   // "ic"
```

根 manifest 暴露的 states：

```ts
global = [
  "Silver",
  "Orange",
  "Blue",
]

angles = [
  "back",
  "backLeft",
  "left",
  "frontLeft",
  "front",
  "frontRight",
  "frontTop",
  "backTop",
  "backBottom",
  "right",
  "backRight",
  "frontBottom",
  "PT_backLeft",
]

mode = [
  "ic",
  "pt",
]
```

独立页面切换：

```ts
scene.states.set("global", "Blue")
scene.states.set("angles", "front")
scene.states.set("mode", "ic")
lotus.tryRequestAnimationFrame()
```

Apple 在 PT → interactive angle 匹配时故意先清空再赋值，以确保同值也重新触发：

```ts
scene.states.set("angles", "")
scene.states.set("angles", "backLeft")
```

监听：

```ts
const dispose = scene.states.bind(
  "global",
  (change: { oldValue: string; newValue: string }, category: string) => {
    console.log(category, change.oldValue, change.newValue)
  },
)

// 清理时
dispose()
```

---

# 10. 提取方式建议

最稳妥的只读提取流程：

1. 从 `main.built.js` 按 module ID/字节区间取出 factory；
2. 对 `8dd4...` 和 `f213...` 直接复制字符串常量；
3. 将 `9ec1...` factory 改成普通函数；
4. 替换 webpack imports：
   ```text
   n.default.quad.easeInOut → 本地 quadEaseInOut
   r.vertex/r.fragment     → photoDepthShaders
   o.commonFragment        → 本地 shader 常量
   o.emissivemapFragment   → 本地 shader 常量
   ```
5. 删除 `createGUI()`，即可同时删除：
   ```text
   ac60...
   99f5... / lil-gui
   ```
6. 保留构造器、`setElementReady()`、`onLoop()`；这三部分是实际 Liquid Glass 运行路径。
7. 在 `createScene()` 前将返回的 class 写入：
   ```js
   Lotus.instance().chunks.entries.set("LockScreenChunk", Class)
   ```

不建议把 Apple webpack factory 和自制 `__webpack_require__` 一起带进 Vite；那仍然隐式依赖 `main.built.js` 的模块编号和 bundle 布局。改成 4 个普通 ESM 文件后，运行时只依赖 `lotus.min.js` 的公开对象：

```text
Chunk
ChunkFields
TimelineFields
ChunkInstructionTarget
ChunkInstructionType
Assets
THREE
Lotus
MobX
```

## 完成情况

- 已检查 live Apple 页面的 DOM、Lotus UMD exports 和 runtime prototype。
- 已定位动态注册模块、Chunk 类、所有 shader 模块及初始化调用。
- 已对六份根场景核对 LockScreenChunk 参数。
- 已提取完整 fields 默认值、uniform 默认值、DOM 属性及 `scene.states` API。
- **文件创建/修改：无。**
- 唯一结构性问题：`main.built.js` 几乎为单行 minified 文件，因此报告采用可复现的 module ID 和字节偏移，而不是无意义的物理行号。