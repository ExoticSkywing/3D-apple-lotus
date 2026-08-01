# Apple Lotus 氛围光方向研究

日期：2026-08-01
目标：在保留 Apple 官方模型、材质、LockScreenChunk 与交互的前提下，提高机身可读性，并探索克制、高级、偏赛博的环境光语言。

## 当前画面测量

基于移动截图上方 75% 画面区域：

| 状态 | 平均灰度 | RGB<12 | RGB<28 | 中灰28–96 |
|---|---:|---:|---:|---:|
| backLeft | 4.07 | 90.0% | 93.9% | 5.9% |
| back | 3.61 | 91.3% | 94.4% | 5.3% |

结论：这不是主观“略暗”，而是约 94% 的画面都落在极暗区。官方镜头可读，但机身大面积消失。

## 推荐参考

### 1. Huly — 精准的冷色舞台光

- Live: https://huly.io
- Case study: https://pixelpoint.io/case-studies/huly
- 可吸收：模型/界面后方的弧形边缘光、深蓝紫空间雾、极轻点阵、冷主调+微暖交互强调。
- 不复制：贯穿主体的过曝白色激光；过曝会吞掉镜头和屏幕细节。

### 2. Active Theory — 微观未来主义

- Live: https://activetheory.net
- WebGPU showcase: https://www.webgpu.com/showcase/active-theory-portfolio
- 可吸收：深蓝黑空间、少量色散边缘、金属/玻璃精确高光、远近粒子形成景深。
- 不复制：高密度粒子云和横向 Lens Flare；产品查看器需要更安静。

### 3. Cyberpunk Interactive 3D Desk — 状态化环境和后期层

- Live: https://3dcyberroom.vercel.app/
- Awwwards: https://www.awwwards.com/sites/cyberpunk-interactive-3d-desk
- 明确可见的系统：Bloom、Chromatic Aberration、neutral textures、nightMix。
- 可吸收：以 nightMix 控制氛围，而不是随机叠霓虹；日/夜或基础/赛博两个光照状态。
- 不复制：房间级杂物、强故障效果、霓虹铺满；会把产品变成场景道具。

### 4. Nymphai Cosmetics — 3D 产品页的信息比例

- Awwwards: https://www.awwwards.com/inspiration/interactive-3d-webgl-product-page-nymphai-cosmetics
- Live: https://nymphaicosmetics.com/products/crema-viso-comfort
- 可吸收：3D主体、排版和控制保持明确层级；用镜头切换组织产品叙事，而不是堆特效。
- 说明：Live 站本次抓取受 `local_rate_limited` 阻断，Awwwards仍保留截图/视频证据。

### 5. Lusion — 高保真实时叙事方法

- Studio: https://lusion.co
- Case study: https://www.awwwards.com/case-study-for-lusion-by-lusion-winner-of-site-of-the-month-may.html
- Porsche: https://lusion.co/projects/porsche_dream_machine
- 可吸收：先定义一个视觉世界和叙事，再让光、运动、材质共同服务；不靠后期掩盖建模或可读性。

### 6. Unseen Studio / Superlist — 少量高价值3D隐喻

- Case study: https://unseen.co/projects/superlist
- 可吸收：少量WebGL 3D元素、滚动和微交互，以“show a lot by showing a little”的方式制造记忆点。
- 技术经验：隐藏面剔除、烘焙动画、轻量matcap，保证移动端性能。

### 7. Nothing — 官方手机模型与透明工业语言

- Official: https://us.nothing.tech
- Community model discovery: https://nothing.community/en/d/52702-where-to-get-free-3d-models-of-nothing-smartphones
- 可吸收：工业细节本身就是赛博语言；透明、结构、Glyph和黑白UI比泛滥的粉蓝霓虹更高级。

## 三个创意方向

### A. Arctic Halo（推荐）

- 背景：黑→深海军蓝径向渐变。
- 环境：提升官方 toneMapping exposure，但保持黑位。
- 轮廓：左上冷青软边条光，右后暖橙极弱边缘光。
- 空间：模型后方一条低亮度椭圆“地平线”，少量远景微尘。
- 镜头：保留官方反射，不增加额外霓虹。
- 特征：最像“Apple Pro走进未来摄影棚”，安全、克制、可读。

### B. Infrared Lab

- 背景：炭黑+极深酒红/铜色雾。
- 主光：银白软箱打亮背板；相机Plateau有细暖边。
- UI：仅选中态出现红外扫描细线。
- 特征：更实验、更工业，适合 Cosmic Orange；蓝色机身可能稍弱。

### C. Spectral Orbit

- 背景：深蓝黑。
- 光：围绕产品旋转的青蓝/紫色窄条高光，随拖拽轻微移动。
- 后期：极低强度色散，只作用于背景光弧，不作用于产品本体。
- 特征：赛博感最强，风险也最高；必须严格限制亮区面积。

## 推荐落地顺序

1. 先恢复产品可读性：让背面至少 20–30% 像素进入中灰区，当前只有约 5%。
2. 再加一主一辅两种环境色，产品本体不直接用高饱和发光材质。
3. 再加入背景光弧/微雾，保持模型轮廓比背景高一档。
4. 最后才考虑 Bloom 或轻色散，并提供关闭/基础模式。

推荐选择 **Arctic Halo**：70% Apple摄影棚，20% Huly冷色舞台，10% Active Theory微观未来感。
