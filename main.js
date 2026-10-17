// 放水燈 3D
// Three.js 場景：真實水面反射、隨時間變化的天空、隨水流漂動的水燈。
// 心願資料存放於 Supabase（與舊版共用 water_lanterns 資料表），失敗時退回 localStorage。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://bvdgbnlzfyygosqtknaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGdibmx6Znl5Z29zcXRrbmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzM3OTQsImV4cCI6MjA3MDA0OTc5NH0.OYPJoXN9LNQuIfyWyDXs0V2BvdbS7Rkw-mXcVskrv4g';
const SUPABASE_MODULE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const TABLE = 'water_lanterns';
const LOCAL_KEY = 'waterLanterns';

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const MAX_LANTERNS = IS_MOBILE ? 60 : 120;

// 湖面範圍：水燈從鏡頭腳下（近岸）出發，漂到遠處後再從近岸重新出現
const LAKE = { near: 50, far: -175, halfWidth: 70 };

const DEMO_WISHES = [
    '願所有人平安健康', '心想事成', '希望明天更美好',
    '祈禱世界和平', '願家人身體健康', '感謝每一天',
    '願友誼長存', '希望夢想成真', '祈求好運連連'
];

// 傳統水燈紙色：米白、暖黃、橙、緋紅、淡粉、淡藍
const PAPER_COLORS = ['#fff3dc', '#ffe2a8', '#ffc58f', '#ff9f86', '#ffc4cf', '#dfe9ff'];

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};
const rand = (a, b) => a + Math.random() * (b - a);
const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

// 平滑的「隨機」閃爍：幾個不相干頻率的正弦疊加，避免每幀亂跳
function flicker(t, seed) {
    return 0.5 * Math.sin(t * 2.3 + seed) +
        0.3 * Math.sin(t * 5.9 + seed * 1.7) +
        0.2 * Math.sin(t * 12.7 + seed * 2.9);
}

function getHour() {
    const param = new URLSearchParams(location.search).get('hour');
    if (param !== null && !Number.isNaN(parseFloat(param))) {
        return ((parseFloat(param) % 24) + 24) % 24;
    }
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
}

function radialTexture(stops, size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([offset, color]) => g.addColorStop(offset, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 可無縫平鋪的水面法線貼圖（整數頻率的正弦波疊加），不依賴外部圖片
function createWaterNormals(size = 256) {
    const waves = [];
    for (let i = 0; i < 28; i++) {
        let kx, ky;
        do {
            kx = Math.round(rand(-10, 10));
            ky = Math.round(rand(-10, 10));
        } while (kx === 0 && ky === 0);
        const k = Math.hypot(kx, ky);
        waves.push({ kx, ky, amp: 1 / (k * k), phase: rand(0, Math.PI * 2) });
    }
    const data = new Uint8Array(size * size * 4);
    let maxSlope = 0;
    const slopes = new Float32Array(size * size * 2);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let dx = 0, dy = 0;
            const u = x / size, v = y / size;
            for (const w of waves) {
                const c = Math.cos(Math.PI * 2 * (w.kx * u + w.ky * v) + w.phase) * w.amp * Math.PI * 2;
                dx += c * w.kx;
                dy += c * w.ky;
            }
            const i = (y * size + x) * 2;
            slopes[i] = dx;
            slopes[i + 1] = dy;
            maxSlope = Math.max(maxSlope, Math.abs(dx), Math.abs(dy));
        }
    }
    const strength = 1.6 / maxSlope;
    for (let i = 0; i < size * size; i++) {
        const nx = -slopes[i * 2] * strength;
        const ny = -slopes[i * 2 + 1] * strength;
        const len = Math.hypot(nx, ny, 1);
        data[i * 4] = ((nx / len) * 0.5 + 0.5) * 255;
        data[i * 4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        data[i * 4 + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}

// ---------------------------------------------------------------------------
// 天色：依太陽高度在幾組關鍵色之間插值
// ---------------------------------------------------------------------------

const SKY_KEYS = [
    { el: -90, top: '#02040b', horizon: '#0a1129', cloud: '#0d1222', water: '#020710', hemi: 0.12, light: '#8fa6d8' },
    { el: -12, top: '#040918', horizon: '#141e43', cloud: '#141a30', water: '#030a16', hemi: 0.16, light: '#8fa6d8' },
    { el: -4, top: '#0b1534', horizon: '#45396a', cloud: '#3a3354', water: '#071226', hemi: 0.3, light: '#b49ad0' },
    { el: 0, top: '#1b2a5a', horizon: '#e27b4e', cloud: '#8e5d72', water: '#0e1b30', hemi: 0.5, light: '#ff9a5c' },
    { el: 6, top: '#2b4f8c', horizon: '#f2a76b', cloud: '#e0a28a', water: '#15304a', hemi: 0.7, light: '#ffc590' },
    { el: 20, top: '#3d74bb', horizon: '#c9dcec', cloud: '#f4f1ee', water: '#1d4258', hemi: 1.0, light: '#fff1de' },
    { el: 90, top: '#2861ad', horizon: '#b9d4ea', cloud: '#ffffff', water: '#1f4a60', hemi: 1.1, light: '#ffffff' }
].map((k) => ({
    ...k,
    top: new THREE.Color(k.top),
    horizon: new THREE.Color(k.horizon),
    cloud: new THREE.Color(k.cloud),
    water: new THREE.Color(k.water),
    light: new THREE.Color(k.light)
}));

function computeSkyState(hour) {
    const elevation = 62 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
    const azimuth = ((hour - 12) / 12) * Math.PI * 0.5;
    const elRad = THREE.MathUtils.degToRad(elevation);
    const sunDir = new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(elRad),
        Math.sin(elRad),
        -Math.cos(azimuth) * Math.cos(elRad)
    ).normalize();

    // 月亮：夜裡掛在湖的左前方，慢慢劃過天空
    const nightProgress = (((hour - 18) % 24) + 24) % 24 / 12;
    const moonAz = -0.45 + nightProgress * 0.5;
    const moonEl = THREE.MathUtils.degToRad(7 + 9 * Math.sin(clamp(nightProgress, 0, 1) * Math.PI));
    const moonDir = new THREE.Vector3(
        Math.sin(moonAz) * Math.cos(moonEl),
        Math.sin(moonEl),
        -Math.cos(moonAz) * Math.cos(moonEl)
    ).normalize();

    let i = 0;
    while (i < SKY_KEYS.length - 2 && elevation > SKY_KEYS[i + 1].el) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    const t = smoothstep(a.el, b.el, elevation);
    const mix = (key) => a[key].clone().lerp(b[key], t);

    const night = 1 - smoothstep(-10, -1, elevation);
    const sunVisible = smoothstep(-5, 2, elevation);
    const sunGlow = new THREE.Color('#ff8a4a').lerp(new THREE.Color('#fff2d8'), smoothstep(2, 25, elevation))
        .multiplyScalar(sunVisible);

    return {
        elevation,
        sunDir,
        moonDir,
        night,
        sunVisible,
        sunGlow,
        top: mix('top'),
        horizon: mix('horizon'),
        cloud: mix('cloud'),
        water: mix('water'),
        hemi: lerp(a.hemi, b.hemi, t),
        light: mix('light')
    };
}

// ---------------------------------------------------------------------------
// 天空 Shader：漸層 + 太陽/月亮 + 星星 + 緩慢流動的雲
// ---------------------------------------------------------------------------

function createSky() {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            uTime: { value: 0 },
            uTop: { value: new THREE.Color() },
            uHorizon: { value: new THREE.Color() },
            uCloud: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3() },
            uSunGlow: { value: new THREE.Color() },
            uMoonDir: { value: new THREE.Vector3() },
            uNight: { value: 0 }
        },
        vertexShader: /* glsl */`
            varying vec3 vWorld;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
                gl_Position.z = gl_Position.w; // 永遠在最遠處
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime;
            uniform vec3 uTop;
            uniform vec3 uHorizon;
            uniform vec3 uCloud;
            uniform vec3 uSunDir;
            uniform vec3 uSunGlow;
            uniform vec3 uMoonDir;
            uniform float uNight;
            varying vec3 vWorld;

            float hash13(vec3 p) {
                p = fract(p * 0.1031);
                p += dot(p, p.zyx + 31.32);
                return fract((p.x + p.y) * p.z);
            }
            float hash12(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
                           mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
            }
            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * noise(p);
                    p = p * 2.03 + vec2(1.7, 9.2);
                    a *= 0.5;
                }
                return v;
            }

            vec3 stars(vec3 dir) {
                vec3 p = dir * 220.0;
                vec3 cell = floor(p);
                float h = hash13(cell);
                if (h < 0.994) return vec3(0.0);
                vec3 center = vec3(hash13(cell + 1.3), hash13(cell + 7.1), hash13(cell + 3.7)) * 0.6 + 0.2;
                float d = length(fract(p) - center);
                float bright = (h - 0.994) / 0.006;
                float twinkle = 0.65 + 0.35 * sin(uTime * (0.8 + bright * 2.5) + h * 400.0);
                float s = smoothstep(0.1 + bright * 0.08, 0.0, d) * twinkle * (0.4 + bright * 1.6);
                vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.86, 1.0), hash13(cell + 5.0));
                return tint * s;
            }

            void main() {
                vec3 dir = normalize(vWorld - cameraPosition);
                float y = dir.y;
                float up = pow(clamp(y, 0.0, 1.0), 0.42);

                vec3 col = mix(uHorizon, uTop, up);

                // 太陽方向的暖色散射
                float sd = max(dot(dir, uSunDir), 0.0);
                col += uSunGlow * (pow(sd, 5.0) * 0.45 * (1.0 - up) + pow(sd, 48.0) * 0.5);

                // 星星
                float aboveHorizon = smoothstep(0.0, 0.12, y);
                vec3 starLight = stars(dir) * uNight * aboveHorizon;

                // 月亮
                float md = dot(dir, uMoonDir);
                float moonDisc = smoothstep(0.99986, 0.99991, md);
                vec3 moonCol = vec3(1.0, 0.95, 0.82) * moonDisc * 3.2;
                moonCol += vec3(0.55, 0.62, 0.8) * (pow(max(md, 0.0), 900.0) * 0.35 + pow(max(md, 0.0), 40.0) * 0.06);
                moonCol *= uNight;

                // 雲：投影到高空平面上的 fbm，緩慢飄移
                vec2 cuv = dir.xz / (y + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
                float n = fbm(cuv);
                float cloudAlpha = smoothstep(0.5, 0.78, n) * smoothstep(0.02, 0.22, y) * 0.85;
                vec3 cloudCol = uCloud * (0.75 + 0.35 * n);
                cloudCol += uSunGlow * pow(sd, 3.0) * 0.55;
                cloudCol += vec3(0.25, 0.28, 0.38) * pow(max(md, 0.0), 12.0) * uNight * 0.6;

                // 太陽本體（會觸發 bloom）
                float sunDisc = smoothstep(0.99955, 0.99975, sd);
                col += uSunGlow * sunDisc * 18.0;

                col += starLight * (1.0 - cloudAlpha);
                col += moonCol * (1.0 - cloudAlpha * 0.8);
                col = mix(col, cloudCol, cloudAlpha);

                // 地平線以下（多被湖面遮住）
                col = mix(col, uHorizon * 0.85, 1.0 - smoothstep(-0.08, 0.0, y));

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
}

// ---------------------------------------------------------------------------
// 遠山：富士山 + 兩層山稜
// ---------------------------------------------------------------------------

function createFuji() {
    const H = 125;
    const R = 300;
    const radial = 180;
    const rings = 70;
    const positions = [];
    const colors = [];
    const indices = [];
    const rock = new THREE.Color('#344156');
    const rockDark = new THREE.Color('#222c3c');
    const snow = new THREE.Color('#eef3f9');
    const color = new THREE.Color();

    // 頂點（火山口略微下凹）
    positions.push(0, H * 0.975, 0);
    colors.push(snow.r, snow.g, snow.b);

    for (let i = 0; i < rings; i++) {
        const s = (i + 1) / rings;
        for (let j = 0; j < radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const ridge = 0.5 * Math.sin(a * 13 + 1.3) + 0.3 * Math.sin(a * 29 + 0.4) + 0.2 * Math.sin(a * 57 + 2.1);
            const r = R * (0.045 + 0.955 * s) * (1 + 0.02 * Math.sin(a * 3 + 0.5));
            let h = H * Math.pow(1 - s, 1.75);
            h += ridge * H * 0.012 * Math.sin(Math.PI * s);
            positions.push(Math.cos(a) * r, h, Math.sin(a) * r);

            const fingers = Math.pow(Math.abs(Math.sin(a * 11 + 0.3)), 6) * 0.2;
            const snowLine = 0.64 - fingers + 0.04 * Math.sin(a * 4 + 1.1) - ridge * 0.03;
            const snowAmount = smoothstep(snowLine - 0.025, snowLine + 0.025, h / H);
            color.copy(rockDark).lerp(rock, 0.5 + ridge * 0.5).lerp(snow, snowAmount);
            colors.push(color.r, color.g, color.b);
        }
    }

    for (let j = 0; j < radial; j++) {
        indices.push(0, 1 + ((j + 1) % radial), 1 + j);
    }
    for (let i = 0; i < rings - 1; i++) {
        for (let j = 0; j < radial; j++) {
            const a = 1 + i * radial + j;
            const b = 1 + i * radial + ((j + 1) % radial);
            const c = 1 + (i + 1) * radial + j;
            const d = 1 + (i + 1) * radial + ((j + 1) % radial);
            indices.push(a, b, c, b, d, c);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.position.set(-30, -3, -560);
    return mesh;
}

function createRidge({ z, base, amp, seed, color, gapFloor, gapInner, gapOuter }) {
    const segments = 260;
    const width = 2400;
    const positions = [];
    const indices = [];
    const n = (x) =>
        0.5 * Math.sin(x * 0.004 + seed) +
        0.3 * Math.sin(x * 0.011 + seed * 2.3) +
        0.15 * Math.sin(x * 0.029 + seed * 4.1) +
        0.05 * Math.sin(x * 0.07 + seed * 7.7);
    for (let i = 0; i <= segments; i++) {
        const x = -width / 2 + (i / segments) * width;
        const gap = lerp(gapFloor, 1, smoothstep(gapInner, gapOuter, Math.abs(x + 30)));
        const y = (base + amp * (0.5 + 0.5 * n(x))) * gap;
        positions.push(x, y, 0, x, -10, 0);
    }
    for (let i = 0; i < segments; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    mesh.position.z = z;
    return mesh;
}

// ---------------------------------------------------------------------------
// 水燈
// ---------------------------------------------------------------------------

const GLOW_TEXTURE = radialTexture([
    [0, 'rgba(255,236,190,1)'],
    [0.18, 'rgba(255,190,110,0.55)'],
    [0.45, 'rgba(255,140,60,0.14)'],
    [1, 'rgba(255,120,40,0)']
]);
const POOL_TEXTURE = radialTexture([
    [0, 'rgba(255,200,130,0.9)'],
    [0.35, 'rgba(255,160,80,0.35)'],
    [1, 'rgba(255,120,40,0)']
]);
const RING_TEXTURE = radialTexture([
    [0, 'rgba(255,255,255,0)'],
    [0.7, 'rgba(255,255,255,0)'],
    [0.84, 'rgba(255,255,255,0.9)'],
    [0.9, 'rgba(255,255,255,0.25)'],
    [1, 'rgba(255,255,255,0)']
]);

const LANTERN_HALF = 0.68;
// 水燈整體縮放：寬約 0.39，跟身高 1.7 的人比起來約 30 公分的真實大小
const LANTERN_SCALE = 0.25;

function createWoodGeometry() {
    const parts = [];
    const box = (w, h, d, x, y, z) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(g);
    };
    // 木底座
    box(1.56, 0.16, 1.56, 0, 0.08, 0);
    // 四根柱子
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            box(0.07, 1.16, 0.07, sx * LANTERN_HALF, 0.16 + 0.58, sz * LANTERN_HALF);
        }
    }
    // 頂部木框
    for (const s of [-1, 1]) {
        box(1.43, 0.06, 0.07, 0, 1.33, s * LANTERN_HALF);
        box(0.07, 0.06, 1.43, s * LANTERN_HALF, 1.33, 0);
    }
    return mergeGeometries(parts);
}

const WOOD_GEOMETRY = createWoodGeometry();
const WOOD_MATERIAL = new THREE.MeshLambertMaterial({ color: '#3a2618' });
// 四面紙壁：4 段的開口圓柱 = 方形紙罩，UV 剛好一面佔 1/4
const PAPER_GEOMETRY = new THREE.CylinderGeometry(
    LANTERN_HALF * Math.SQRT2 * 0.97, LANTERN_HALF * Math.SQRT2 * 0.97, 1.12, 4, 1, true, Math.PI / 4
);
PAPER_GEOMETRY.translate(0, 0.16 + 0.56, 0);
const POOL_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function wishGlyphs(message) {
    const clean = message
        .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
        .replace(/\s+/g, '')
        .trim();
    return Array.from(clean).slice(0, 6);
}

function createPaperTexture(message, id) {
    const panelW = 64;
    const panelH = 256;
    const canvas = document.createElement('canvas');
    canvas.width = panelW * 4;
    canvas.height = panelH;
    const ctx = canvas.getContext('2d');

    for (let p = 0; p < 4; p++) {
        const x0 = p * panelW;
        // 燭光從底部透出：下亮上暗
        const g = ctx.createLinearGradient(0, panelH, 0, 0);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, '#fff4e2');
        g.addColorStop(1, '#e9d6bd');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, panelW, panelH);

        // 和紙纖維
        ctx.strokeStyle = 'rgba(150, 110, 70, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 26; i++) {
            const fx = x0 + Math.random() * panelW;
            const fy = Math.random() * panelH;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.quadraticCurveTo(fx + rand(-6, 6), fy + rand(-8, 8), fx + rand(-10, 10), fy + rand(-14, 14));
            ctx.stroke();
        }

        // 面板邊緣的柔和陰影
        const edge = ctx.createLinearGradient(x0, 0, x0 + panelW, 0);
        edge.addColorStop(0, 'rgba(90,50,20,0.22)');
        edge.addColorStop(0.12, 'rgba(90,50,20,0)');
        edge.addColorStop(0.88, 'rgba(90,50,20,0)');
        edge.addColorStop(1, 'rgba(90,50,20,0.22)');
        ctx.fillStyle = edge;
        ctx.fillRect(x0, 0, panelW, panelH);
    }

    // 正反兩面直書心願
    const glyphs = wishGlyphs(message);
    const fontSize = glyphs.length > 4 ? 30 : 36;
    ctx.font = `600 ${fontSize}px "Noto Serif TC", "Songti TC", "Hiragino Mincho ProN", "PMingLiU", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(55, 25, 12, 0.78)';
    const step = fontSize * 1.08;
    const startY = panelH / 2 - ((glyphs.length - 1) * step) / 2;
    for (const p of [0, 2]) {
        glyphs.forEach((ch, i) => ctx.fillText(ch, p * panelW + panelW / 2, startY + i * step));
    }
    // 側面寫編號
    ctx.font = '500 13px serif';
    ctx.fillStyle = 'rgba(55, 25, 12, 0.5)';
    const label = String(id).padStart(4, '0');
    for (const p of [1, 3]) {
        Array.from(label).forEach((ch, i) => ctx.fillText(ch, p * panelW + panelW / 2, panelH - 70 + i * 14));
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

// 水面起伏：幾道方向不同的長波，水燈依此上下浮動並傾斜
const WAVES = [
    { kx: 0.21, kz: 0.13, w: 0.9, a: 0.07 },
    { kx: -0.12, kz: 0.27, w: 0.7, a: 0.06 },
    { kx: 0.37, kz: -0.19, w: 1.3, a: 0.03 },
    { kx: 0.05, kz: 0.46, w: 1.7, a: 0.022 }
];
function sampleWave(x, z, t) {
    let h = 0, dx = 0, dz = 0;
    for (const w of WAVES) {
        const ph = w.kx * x + w.kz * z + w.w * t;
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        h += w.a * s;
        dx += w.a * w.kx * c;
        dz += w.a * w.kz * c;
    }
    return { h, dx, dz };
}

// 水流：整體往遠方流，加上緩慢的渦旋與輕微向中央匯聚
function flowAt(x, z, t) {
    const vx = 0.16 * Math.sin(z * 0.035 + t * 0.05) +
        0.1 * Math.sin(x * 0.045 - t * 0.04 + 1.3) -
        x * 0.0016;
    const vz = -0.42 - 0.1 * Math.sin(x * 0.05 + t * 0.03) - 0.06 * Math.sin(z * 0.02 - t * 0.02);
    return { vx, vz };
}

class Lantern {
    constructor(scene, { id, message, x, z }) {
        this.id = id;
        this.message = message;
        this.seed = Math.random() * 100;
        this.speed = rand(0.75, 1.25);

        const tint = new THREE.Color(PAPER_COLORS[Math.floor(Math.random() * PAPER_COLORS.length)]);
        this.paperTint = tint;
        this.paperMaterial = new THREE.MeshBasicMaterial({
            map: createPaperTexture(message, id),
            color: tint.clone(),
            side: THREE.DoubleSide
        });

        this.group = new THREE.Group();
        const wood = new THREE.Mesh(WOOD_GEOMETRY, WOOD_MATERIAL);
        const paper = new THREE.Mesh(PAPER_GEOMETRY, this.paperMaterial);
        wood.userData.lantern = this;
        paper.userData.lantern = this;
        this.pickables = [wood, paper];
        this.group.add(wood, paper);
        this.group.scale.setScalar(LANTERN_SCALE);

        const glowColor = new THREE.Color('#ffb874').lerp(tint, 0.2);
        this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: GLOW_TEXTURE,
            color: glowColor,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            fog: false
        }));
        this.glow.scale.setScalar(1.1);

        this.pool = new THREE.Mesh(POOL_GEOMETRY, new THREE.MeshBasicMaterial({
            map: POOL_TEXTURE,
            color: glowColor,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            fog: false
        }));
        this.pool.scale.setScalar(2.0);

        scene.add(this.group, this.glow, this.pool);

        this.x = x;
        this.z = z;
        this.vx = 0;
        this.vz = 0;
        this.yaw = rand(0, Math.PI * 2);
        this.yawVel = rand(-0.05, 0.05);
        this.tiltX = 0;
        this.tiltZ = 0;
        this.light = 1;          // 燭火亮度（新放的水燈會從 0 慢慢點亮）
        this.drop = 0;           // 放入水中的高度偏移
        this.dropTime = -1;
        this.dropHeight = 1.6;
        this.dropDuration = 1.6;
        this.nextRipple = rand(2, 9);
        this.retired = false;
        this.removed = false;

        this._qTilt = new THREE.Quaternion();
        this._qYaw = new THREE.Quaternion();
        this._euler = new THREE.Euler();
    }

    release(height = 1.6) {
        this.light = 0;
        this.dropHeight = height;
        this.dropDuration = 0.8 + height * 0.5;
        this.drop = height;
        this.dropTime = 0;
        this.splashed = false;
    }

    setVisible(visible) {
        this.group.visible = visible;
        this.glow.visible = visible;
        this.pool.visible = visible;
    }

    // 由岸邊蹲下的人從手上放進水裡（x, y, z 是手上水燈的位置）
    launchAt(x, y, z) {
        this.waiting = false;
        this.setVisible(true);
        this.x = x;
        this.z = z;
        this.vx = 0;
        this.vz = -0.25;
        this.release(Math.max(0.1, y));
    }

    update(dt, t, ctx) {
        if (this.waiting) return;
        // 漂流：速度慢慢追上水流（有慣性）
        const flow = flowAt(this.x, this.z, t);
        this.vx = damp(this.vx, flow.vx * this.speed + ctx.pushX, 0.6, dt);
        this.vz = damp(this.vz, flow.vz * this.speed + ctx.pushZ, 0.6, dt);
        if (this.dropTime < 0 || this.dropTime > this.dropDuration) {
            this.x += this.vx * dt;
            this.z += this.vz * dt;
        }
        this.x = clamp(this.x, -LAKE.halfWidth, LAKE.halfWidth);
        ctx.shore.keepInWater(this);

        // 隨波浮沉與傾斜（彈簧阻尼，帶一點遲滯感）
        const wave = sampleWave(this.x, this.z, t);
        this.tiltX = damp(this.tiltX, wave.dz * 4.5, 2.5, dt);
        this.tiltZ = damp(this.tiltZ, -wave.dx * 4.5, 2.5, dt);
        this.yawVel = damp(this.yawVel, 0.04 * Math.sin(t * 0.07 + this.seed), 0.3, dt);
        this.yaw += this.yawVel * dt;

        // 放下動畫：緩緩降到水面，落水後輕輕晃幾下
        let settle = 0;
        if (this.dropTime >= 0) {
            this.dropTime += dt;
            const p = clamp(this.dropTime / this.dropDuration, 0, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            this.drop = this.dropHeight * (1 - ease);
            if (p >= 1) {
                const s = this.dropTime - this.dropDuration;
                settle = 0.07 * Math.exp(-s * 1.4) * Math.sin(s * 6);
                this.tiltX += 0.06 * Math.exp(-s * 1.2) * Math.sin(s * 4.3) * dt * 10;
                if (!this.splashed) {
                    this.splashed = true;
                    ctx.ripples.spawn(this.x, this.z, 0.55, 0.9);
                    ctx.ripples.spawn(this.x, this.z, 0.35, 0.55, 0.5);
                    ctx.ripples.spawn(this.x, this.z, 0.2, 0.35, 1.1);
                }
                if (s > 6) this.dropTime = -1;
            }
            this.light = damp(this.light, 1, 1.4, dt);
        }

        const y = (wave.h * 0.85 - 0.05) * LANTERN_SCALE + this.drop + settle;
        this.group.position.set(this.x, y, this.z);
        this._euler.set(this.tiltX, 0, this.tiltZ);
        this._qTilt.setFromEuler(this._euler);
        this._qYaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);
        this.group.quaternion.multiplyQuaternions(this._qTilt, this._qYaw);

        // 燭光閃爍
        const f = 1 + 0.1 * flicker(t, this.seed) + 0.04 * flicker(t * 3.1, this.seed + 4);
        const distance = Math.hypot(this.x - ctx.cameraPos.x, this.z - ctx.cameraPos.z);
        const distanceFade = 1 - smoothstep(140, 260, distance);
        const glowBoost = lerp(0.55, 1, ctx.night);
        const bright = this.light * f;

        this.paperMaterial.color.copy(this.paperTint).multiplyScalar(lerp(1.0, 1.15, ctx.night) * (0.35 + 0.65 * bright));
        this.glow.position.set(this.x, y + 0.2, this.z);
        this.glow.material.opacity = 0.9 * bright * glowBoost * distanceFade;
        this.glow.scale.setScalar(1.05 + 0.08 * f);
        this.pool.position.set(this.x, 0.03, this.z);
        this.pool.material.opacity = 0.32 * bright * glowBoost * distanceFade;

        // 偶爾泛起一圈漣漪
        this.nextRipple -= dt;
        if (this.nextRipple <= 0) {
            this.nextRipple = rand(5, 11);
            if (distance < 120) ctx.ripples.spawn(this.x, this.z, 0.12, 0.6);
        }

        // 漂到遠處：退役的水燈消失，其他水燈回到岸邊，等人再放一次
        if (this.z < LAKE.far) {
            if (this.retired) {
                this.dispose();
            } else {
                ctx.shore.enqueue(this);
            }
        }
    }

    worldAnchor(target) {
        return target.set(this.x, this.group.position.y + 0.6, this.z);
    }

    dispose() {
        this.removed = true;
        this.group.parent?.remove(this.group);
        this.glow.parent?.remove(this.glow);
        this.pool.parent?.remove(this.pool);
        this.paperMaterial.map.dispose();
        this.paperMaterial.dispose();
        this.glow.material.dispose();
        this.pool.material.dispose();
    }
}

// 漣漪池：預先建立固定數量的圓環，循環使用
class Ripples {
    constructor(scene, count = 40) {
        this.items = [];
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(POOL_GEOMETRY, new THREE.MeshBasicMaterial({
                map: RING_TEXTURE,
                color: '#ffe9cc',
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0,
                fog: false
            }));
            mesh.visible = false;
            scene.add(mesh);
            this.items.push({ mesh, life: 0, duration: 1, strength: 0, size: 1, delay: 0 });
        }
        this.cursor = 0;
    }

    spawn(x, z, strength, size = 1.5, delay = 0) {
        const item = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % this.items.length;
        item.mesh.position.set(x, 0.025, z);
        item.life = 0;
        item.delay = delay;
        item.duration = 3.5 + size;
        item.strength = strength;
        item.size = size;
        item.mesh.visible = false;
    }

    update(dt, brightness) {
        for (const item of this.items) {
            if (item.strength <= 0) continue;
            if (item.delay > 0) {
                item.delay -= dt;
                continue;
            }
            item.life += dt;
            const p = item.life / item.duration;
            if (p >= 1) {
                item.strength = 0;
                item.mesh.visible = false;
                continue;
            }
            item.mesh.visible = true;
            item.mesh.scale.setScalar(0.5 + p * 6 * item.size);
            item.mesh.material.opacity = item.strength * brightness * Math.pow(1 - p, 2) * smoothstep(0, 0.08, p);
        }
    }
}

// ---------------------------------------------------------------------------
// 岸邊：堤岸、木棧橋、石階、岸上的人（蹲在水邊把水燈放進湖裡）
// ---------------------------------------------------------------------------

const SHORE_Z = 22;     // 岸線大致位置（鏡頭站在岸上，往 -z 方向看湖）
const LAND_Y = 0.9;     // 岸面高度
const PIER = { x: -6, rootZ: SHORE_Z + 3, tipZ: SHORE_Z - 13, halfW: 1.2, deckY: 0.8 };

function shoreEdge(x) {
    const bend = Math.max(0, Math.abs(x) - 45) * 0.22;
    return SHORE_Z + 1.0 * Math.sin(x * 0.06 + 0.8) + 0.5 * Math.sin(x * 0.17 + 2.0) - bend;
}

function landHeight(x, d) {
    // d：離岸線的距離，越往後越高，形成緩坡
    return LAND_Y + smoothstep(8, 60, d) * (3 + 2 * Math.sin(x * 0.03)) + 0.06 * Math.sin(x * 1.3 + d * 0.9);
}

const materialCache = new Map();
function lambert(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshLambertMaterial({ color, ...options }));
    return materialCache.get(key);
}

function createGround() {
    const xs = [];
    for (let i = 0; i <= 160; i++) xs.push(-260 + (i / 160) * 520);
    // 每一列：[離岸線距離, 固定高度(null 表示用地形)]
    const rows = [[-2.6, -1.2], [-0.7, 0.2], [0, LAND_Y], [0.8, null], [2, null], [4, null], [7, null],
        [11, null], [16, null], [24, null], [35, null], [50, null], [70, null], [100, null], [140, null]];
    const positions = [];
    const colors = [];
    const indices = [];
    const stone = new THREE.Color('#57524b');
    const gravel = new THREE.Color('#6a604f');
    const grass = new THREE.Color('#2c3a22');
    const grass2 = new THREE.Color('#3f4528');
    const c = new THREE.Color();
    rows.forEach(([d, fixedY], r) => {
        xs.forEach((x) => {
            const z = shoreEdge(x) + d;
            const y = fixedY ?? landHeight(x, d);
            positions.push(x, y, z);
            const n = 0.5 + 0.5 * Math.sin(x * 0.7 + r * 1.9) * Math.sin(x * 0.23 - r);
            if (r < 2) c.copy(stone).multiplyScalar(0.8 + 0.4 * n);
            else if (r === 2) c.copy(gravel);
            else c.copy(grass).lerp(grass2, n).lerp(gravel, r === 3 ? 0.5 : 0);
            colors.push(c.r, c.g, c.b);
        });
    });
    const w = xs.length;
    for (let r = 0; r < rows.length - 1; r++) {
        for (let i = 0; i < w - 1; i++) {
            const a = r * w + i, b = a + 1, cc = a + w, d = cc + 1;
            indices.push(a, cc, b, b, cc, d);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

function createPier() {
    const planks = [];
    const frame = [];
    const length = PIER.rootZ - PIER.tipZ;
    for (let z = PIER.tipZ + 0.16; z < PIER.rootZ; z += 0.34) {
        const g = new THREE.BoxGeometry(PIER.halfW * 2, 0.07, 0.3);
        g.rotateY(rand(-0.015, 0.015));
        g.translate(rand(-0.03, 0.03), PIER.deckY + rand(-0.012, 0.012), z);
        planks.push(g);
    }
    for (const s of [-1, 1]) {
        const beam = new THREE.BoxGeometry(0.14, 0.18, length);
        beam.translate(s * (PIER.halfW - 0.2), PIER.deckY - 0.13, PIER.tipZ + length / 2);
        frame.push(beam);
        for (let z = PIER.tipZ + 0.2; z < SHORE_Z; z += 2.6) {
            const post = new THREE.CylinderGeometry(0.09, 0.1, 2.6, 8);
            post.translate(s * (PIER.halfW - 0.05), PIER.deckY - 1.25, z);
            frame.push(post);
        }
    }
    const group = new THREE.Group();
    group.add(new THREE.Mesh(mergeGeometries(planks), lambert('#5d4632')));
    group.add(new THREE.Mesh(mergeGeometries(frame), lambert('#2e2219')));
    group.position.x = PIER.x;
    return group;
}

function createRock(x, z, r, y = 0.1) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(rand(1, 1.5), rand(0.5, 0.8), rand(0.9, 1.3));
    const mesh = new THREE.Mesh(g, lambert('#4e4a45', { flatShading: true }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rand(0, Math.PI);
    return mesh;
}

function createPine(x, z) {
    const parts = [];
    const h = rand(5, 9);
    const trunk = new THREE.CylinderGeometry(0.15, 0.25, h * 0.45, 6);
    trunk.translate(0, h * 0.22, 0);
    const trunkMesh = new THREE.Mesh(trunk, lambert('#2b211a'));
    for (let i = 0; i < 3; i++) {
        const cone = new THREE.ConeGeometry(h * (0.32 - i * 0.07), h * 0.42, 7);
        cone.translate(0, h * (0.42 + i * 0.2), 0);
        parts.push(cone);
    }
    const group = new THREE.Group();
    group.add(trunkMesh, new THREE.Mesh(mergeGeometries(parts), lambert('#1c2a1f', { flatShading: true })));
    group.position.set(x, landHeight(x, z - shoreEdge(x)) - 0.1, z);
    group.rotation.y = rand(0, Math.PI);
    return group;
}

// 工地常見的三腳架 LED 投光燈：很亮的冷白光，照向棧橋和水面
function createWorkLight(x, y, z, aim) {
    const group = new THREE.Group();
    const metal = lambert('#2b2d30');
    // 三腳架
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.25, 6), metal);
        leg.position.set(Math.cos(a) * 0.28, 0.58, Math.sin(a) * 0.28);
        leg.rotation.set(Math.sin(a) * -0.45, 0, Math.cos(a) * 0.45);
        group.add(leg);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.9, 8), metal);
    mast.position.y = 1.95;
    group.add(mast);

    // 燈頭：黃色外殼、發光的燈面，朝目標方向低頭
    const head = new THREE.Group();
    head.position.y = 2.95;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.14), lambert('#d9a520'));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    face.position.z = -0.075;
    face.rotation.y = Math.PI;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEXTURE,
        color: '#dfe8ff',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false
    }));
    glow.scale.setScalar(3.2);
    glow.position.z = -0.2;
    head.add(housing, face, glow);
    group.add(head);

    const light = new THREE.SpotLight('#eef2ff', 0, 42, 0.62, 0.55, 1.1);
    light.position.set(0, 2.95, 0);
    group.add(light, light.target);
    group.position.set(x, y, z);

    // 讓燈頭（發光面朝 -z）與光線都對準目標
    const local = new THREE.Vector3(aim.x - x, aim.y - y, aim.z - z);
    light.target.position.copy(local);
    const yaw = Math.atan2(-local.x, -local.z);
    const pitch = -Math.atan2(2.95 - local.y, Math.hypot(local.x, local.z));
    head.rotation.set(pitch, yaw, 0, 'YXZ');

    group.userData = { face, glow, light, seed: rand(0, 100) };
    return group;
}

function updateWorkLight(lamp, night) {
    const { face, glow, light } = lamp.userData;
    face.material.color.setScalar(lerp(1.2, 3.2, night));
    glow.material.opacity = lerp(0.25, 0.9, night);
    light.intensity = lerp(1.5, 14, night);
}

// 煤油馬燈：放在棧橋或木箱上，暖黃色的火光
function createHurricaneLamp(x, y, z) {
    const group = new THREE.Group();
    const iron = lambert('#5a1f1a');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 12), iron);
    base.position.y = 0.035;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
    globe.scale.y = 1.35;
    globe.position.y = 0.17;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.07, 12), iron);
    cap.position.y = 0.3;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 16, Math.PI), iron);
    handle.position.y = 0.33;
    for (const s of [-1, 1]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.24, 4), iron);
        rod.position.set(s * 0.085, 0.17, 0);
        group.add(rod);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEXTURE,
        color: '#ffb05a',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false
    }));
    glow.scale.setScalar(1.3);
    glow.position.y = 0.17;
    const light = new THREE.PointLight('#ffad5c', 0, 6, 1.5);
    light.position.y = 0.2;
    group.add(base, globe, cap, handle, glow, light);
    group.position.set(x, y, z);
    group.userData = { globe, glow, light, seed: rand(0, 100) };
    return group;
}

function updateHurricaneLamp(lamp, t, night) {
    const { globe, glow, light, seed } = lamp.userData;
    const f = 1 + 0.08 * flicker(t * 1.4, seed);
    globe.material.color.set('#ffd28a').multiplyScalar(lerp(1.0, 1.8, night) * f);
    glow.material.opacity = lerp(0.3, 0.85, night) * f;
    light.intensity = lerp(0.2, 2.2, night) * f;
}

// 迷你水燈：人雙手托在掌上的那一盞
function createHeldToro() {
    const group = new THREE.Group();
    const wood = new THREE.Mesh(WOOD_GEOMETRY, WOOD_MATERIAL);
    const paper = new THREE.Mesh(PAPER_GEOMETRY, new THREE.MeshBasicMaterial({ color: '#ffe6b8', side: THREE.DoubleSide }));
    group.add(wood, paper);
    group.scale.setScalar(LANTERN_SCALE);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEXTURE,
        color: '#ffb874',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false
    }));
    glow.scale.setScalar(0.8 / LANTERN_SCALE);
    glow.position.y = 0.8;
    group.add(glow);
    group.userData = { paper, glow };
    return group;
}

// 岸上的人：帶關節的低多邊形人偶（髖、大腿、小腿、軀幹、頭、手臂），可以站、走、蹲。面向 -z。
// outfit：yukata 浴衣 / suit 西裝 / tshirt T 恤 / dress 洋裝
// hairStyle：bun 盤髮 / short 短髮 / long 長髮 / curly 捲髮 / buzz 平頭
function createPerson({
    outfit = 'yukata', top, bottom = '#2d3446', accent = '#e8c35a',
    hair = '#17110d', hairStyle = 'short', skin = '#e3bf9c', shorts = false, scale = 1, holding = false
}) {
    const root = new THREE.Group();
    const add = (geometry, color, x, y, z, parent) => {
        const mesh = new THREE.Mesh(geometry, lambert(color));
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    };
    const shoe = outfit === 'yukata' ? '#2a2018' : outfit === 'suit' ? '#141110' : '#e6e2da';

    // 髖部：雙腿與上半身都掛在這裡
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    root.add(hips);

    const thighColor = outfit === 'tshirt' || outfit === 'suit' ? bottom : skin;
    const shinColor = outfit === 'suit' || (outfit === 'tshirt' && !shorts) ? bottom : skin;
    const legs = [];
    for (const side of [-1, 1]) {
        const thigh = new THREE.Group();
        thigh.position.set(side * 0.085, 0, 0);
        hips.add(thigh);
        add(new THREE.CylinderGeometry(0.078, 0.07, 0.47, 8), thighColor, 0, -0.235, 0, thigh);
        const knee = new THREE.Group();
        knee.position.y = -0.47;
        thigh.add(knee);
        add(new THREE.CylinderGeometry(0.066, 0.055, 0.44, 8), shinColor, 0, -0.22, 0, knee);
        add(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe, 0, -0.45, -0.05, knee);
        legs.push({ thigh, knee, side });
    }

    // 浴衣、洋裝的下襬（蹲下時會壓短、往前撐開）
    let skirt = null;
    if (outfit === 'yukata') {
        skirt = add(new THREE.CylinderGeometry(0.19, 0.27, 0.9, 12), top, 0, -0.45, 0, hips);
        skirt.userData = { top: 0, h: 0.9 };
    } else if (outfit === 'dress') {
        skirt = add(new THREE.CylinderGeometry(0.18, 0.3, 0.5, 14), bottom, 0, -0.2, 0, hips);
        skirt.userData = { top: 0.05, h: 0.5 };
    }

    // 上半身
    const torso = new THREE.Group();
    torso.position.y = 0.05;
    hips.add(torso);
    if (outfit === 'yukata') {
        add(new THREE.CylinderGeometry(0.205, 0.2, 0.16, 12), accent, 0, 0, 0, torso);
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), top, 0, 0.25, 0, torso);
    } else {
        if (outfit !== 'dress') add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), outfit === 'suit' ? '#111111' : '#3a2c22', 0, -0.02, 0, torso);
        add(new THREE.CylinderGeometry(0.2, 0.17, 0.44, 12), top, 0, 0.22, 0, torso);
        if (outfit === 'suit') {
            add(new THREE.BoxGeometry(0.1, 0.22, 0.02), '#f2f0ea', 0, 0.32, -0.19, torso);
            add(new THREE.BoxGeometry(0.035, 0.2, 0.02), accent, 0, 0.3, -0.2, torso);
        }
    }

    const head = new THREE.Group();
    head.position.y = 0.65;
    torso.add(head);
    add(new THREE.SphereGeometry(0.125, 14, 10), skin, 0, 0, 0, head);
    const cap = { buzz: 0.42, short: 0.55, bun: 0.55, long: 0.58, curly: 0.6 }[hairStyle] ?? 0.55;
    add(new THREE.SphereGeometry(hairStyle === 'buzz' ? 0.128 : 0.134, 14, 10, 0, Math.PI * 2, 0, Math.PI * cap), hair, 0, 0.012, 0.012, head);
    if (hairStyle === 'bun') add(new THREE.SphereGeometry(0.06, 10, 8), hair, 0, 0.1, 0.09, head);
    if (hairStyle === 'long') add(new THREE.BoxGeometry(0.24, 0.32, 0.08), hair, 0, -0.1, 0.1, head);
    if (hairStyle === 'curly') {
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            add(new THREE.SphereGeometry(0.06, 8, 6), hair, Math.cos(a) * 0.1, 0.07, Math.sin(a) * 0.1 + 0.02, head);
        }
    }

    // 手臂：浴衣寬袖、西裝長袖、T 恤短袖露出前臂
    const arms = [];
    for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.24, 0.45, 0);
        pivot.rotation.z = side * 0.08;
        if (outfit === 'yukata') {
            add(new THREE.BoxGeometry(0.13, 0.42, 0.24), top, 0, -0.2, 0.02, pivot);
        } else if (outfit === 'suit') {
            add(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 8), top, 0, -0.2, 0, pivot);
        } else {
            add(new THREE.CylinderGeometry(0.065, 0.062, 0.16, 8), top, 0, -0.07, 0, pivot);
            add(new THREE.CylinderGeometry(0.045, 0.04, 0.3, 8), skin, 0, -0.29, 0, pivot);
        }
        add(new THREE.SphereGeometry(0.045, 8, 6), skin, 0, -0.45, -0.02, pivot);
        torso.add(pivot);
        arms.push(pivot);
    }

    let held = null;
    if (holding) {
        held = createHeldToro();
        root.add(held);
    }

    root.scale.setScalar(scale);
    return {
        root, hips, torso, head, legs, arms, skirt, held, scale,
        crouch: 0, crouchTarget: 0,     // 0 站著、1 蹲下
        walk: 0, phase: 0,              // 走路的程度與步伐相位
        releaseT: -1,                   // 放燈動作的計時
        path: null, pathIndex: 0, speed: 1.0 * (0.7 + 0.3 * scale),
        faceYaw: null, look: 0,
        seed: rand(0, 100)
    };
}

function dampAngle(a, b, lambda, dt) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + diff * (1 - Math.exp(-lambda * dt));
}

// 沿著路徑點走過去；回傳是否已經走到
function stepAlongPath(p, dt) {
    if (!p.path) {
        p.walk = damp(p.walk, 0, 6, dt);
        return true;
    }
    const pos = p.root.position;
    const target = p.path[p.pathIndex];
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.04) {
        pos.y = target.y;
        p.pathIndex += 1;
        if (p.pathIndex >= p.path.length) p.path = null;
        return !p.path;
    }
    const step = Math.min(dist, p.speed * p.walk * dt + 0.002);
    pos.x += (dx / dist) * step;
    pos.z += (dz / dist) * step;
    pos.y += (target.y - pos.y) * (step / dist);
    p.root.rotation.y = dampAngle(p.root.rotation.y, Math.atan2(-dx, -dz), 7, dt);
    p.walk = damp(p.walk, 1, 5, dt);
    p.phase += dt * p.speed * p.walk * Math.PI / (0.55 * p.scale);
    return false;
}

function walkTo(p, points) {
    p.path = points.map((v) => v.clone());
    p.pathIndex = 0;
    p.faceYaw = null;
}

// 依目前狀態擺姿勢：站 / 走 / 蹲 / 放燈
function animatePerson(p, dt, t) {
    p.crouch = damp(p.crouch, p.crouchTarget, 3.5, dt);
    const c = smoothstep(0, 1, p.crouch);
    const w = p.walk;
    const idle = (1 - w) * (1 - c);

    let reach = 0;
    if (p.releaseT >= 0) {
        p.releaseT += dt;
        const r = p.releaseT;
        reach = r < 0.9 ? smoothstep(0, 0.9, r) : 1 - smoothstep(1.3, 2.6, r);
        if (r > 2.6) p.releaseT = -1;
    }

    p.hips.position.y = lerp(0.95, 0.4, c) - w * 0.025 * Math.abs(Math.cos(p.phase));
    for (const { thigh, knee, side } of p.legs) {
        const ph = p.phase + (side > 0 ? Math.PI : 0);
        const walkThigh = 0.42 * Math.sin(ph) * w;
        const walkKnee = (-0.75 * Math.max(0, Math.sin(ph - 1.2)) - 0.06) * w;
        thigh.rotation.x = lerp(walkThigh, 1.35, c);
        thigh.rotation.z = side * 0.06 * c;
        knee.rotation.x = lerp(walkKnee, -2.35, c);
    }
    if (p.skirt) {
        const k = lerp(1, 0.5, c);
        p.skirt.scale.set(1 + 0.15 * c, k, 1 + 0.45 * c);
        p.skirt.position.set(0, p.skirt.userData.top - (p.skirt.userData.h / 2) * k, -0.12 * c);
    }

    const sway = Math.sin(t * 0.7 + p.seed);
    p.torso.rotation.x = lerp(-0.05 * w, -0.5, c) - 0.22 * reach + 0.012 * sway * idle;
    p.root.rotation.z = 0.01 * sway * idle;
    p.head.rotation.y = damp(p.head.rotation.y, p.look * idle, 1.5, dt);

    const holdingToro = p.held && p.held.visible;
    p.arms.forEach((arm, i) => {
        const side = i === 0 ? -1 : 1;
        let target;
        if (holdingToro) {
            // 雙手在胸前托著水燈；蹲下時往水面送出去
            target = lerp(0.95, 1.4, c) + 0.45 * reach;
            arm.rotation.z = side * lerp(0.08, -0.12, 1);
        } else {
            const swing = 0.38 * Math.sin(p.phase + (side > 0 ? 0 : Math.PI)) * w;
            target = lerp(0.1 + swing, 1.4 + 0.45 * reach, c);
            arm.rotation.z = side * 0.08;
        }
        arm.rotation.x = damp(arm.rotation.x, target, 10, dt);
    });

    if (p.held) {
        // 托在掌心上：站著時在胸前，蹲下時貼近水面，放燈時再往前送
        p.held.position.set(0, lerp(1.14, 0.52, c) - 0.14 * reach, lerp(-0.38, -0.58, c) - 0.12 * reach);
    }

    if (p.faceYaw !== null && !p.path) {
        p.root.rotation.y = dampAngle(p.root.rotation.y, p.faceYaw, 4, dt);
    }
}

function createShore(scene) {
    const group = new THREE.Group();
    group.add(createGround(), createPier());

    // 石階（右邊）與水邊的平石
    const stepX = 9;
    const stepEdge = shoreEdge(stepX);
    [[0.62, 0.35], [0.36, 1.1], [0.1, 1.85]].forEach(([y, back]) => {
        const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.26, 0.85), lambert('#625c54'));
        step.position.set(stepX, y, stepEdge - back);
        group.add(step);
    });
    const slabX = 23;
    const slabEdge = shoreEdge(slabX);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 1.5), lambert('#57524c', { flatShading: true }));
    slab.position.set(slabX, 0.14, slabEdge - 1.2);
    slab.rotation.y = 0.2;
    group.add(slab);

    // 水邊散落的石頭
    for (let i = 0; i < 26; i++) {
        const x = rand(-60, 60);
        if (Math.abs(x - PIER.x) < 2.5 || Math.abs(x - stepX) < 2 || Math.abs(x - slabX) < 2) continue;
        group.add(createRock(x, shoreEdge(x) - rand(0.4, 1.6), rand(0.25, 0.7), rand(-0.05, 0.2)));
    }

    // 松樹
    for (let i = 0; i < 18; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * rand(32, 85);
        group.add(createPine(x, shoreEdge(x) + rand(5, 30)));
    }

    const deck = PIER.deckY + 0.035;
    const landAt = (x, d) => new THREE.Vector3(x, landHeight(x, d), shoreEdge(x) + d);

    // 照明：三腳架投光燈（照向棧橋與水面）與煤油馬燈
    const workLights = [
        createWorkLight(PIER.x + 1.7, LAND_Y, PIER.rootZ + 0.8, new THREE.Vector3(PIER.x, 0, PIER.tipZ - 4)),
        createWorkLight(stepX + 2.6, LAND_Y, stepEdge + 1.8, new THREE.Vector3(stepX - 1, 0, stepEdge - 6)),
        createWorkLight(-19, LAND_Y, shoreEdge(-19) + 2.4, new THREE.Vector3(-17, 0, shoreEdge(-17) - 8))
    ];
    const lamps = [
        createHurricaneLamp(PIER.x + 1.0, deck, PIER.tipZ + 0.6),
        createHurricaneLamp(PIER.x + 1.0, deck, PIER.tipZ + 6.5),
        createHurricaneLamp(slabX + 0.7, 0.31, slabEdge - 1.0),
        createHurricaneLamp(31, LAND_Y, shoreEdge(31) + 2.0)
    ];
    group.add(...workLights, ...lamps);

    // 人
    const people = [];
    const place = (opts, at, yaw = 0) => {
        const person = createPerson(opts);
        person.root.position.copy(at);
        person.root.rotation.y = yaw;
        person.faceYaw = yaw;
        group.add(person.root);
        people.push(person);
        return person;
    };

    // 放燈的人：在岸上捧起一盞水燈 → 走到水邊 → 蹲下放進水裡 → 站起來走回岸上
    const releaserDefs = [
        {   // 棧橋：金髮、藍 T 恤配牛仔褲
            opts: { outfit: 'tshirt', top: '#2f6db5', bottom: '#33415c', hair: '#d9b56a', hairStyle: 'short', skin: '#f1d3bd' },
            path: [landAt(PIER.x - 1.4, 1.6), new THREE.Vector3(PIER.x - 0.55, deck, PIER.rootZ - 1), new THREE.Vector3(PIER.x - 0.55, deck, PIER.tipZ + 0.4)]
        },
        {   // 石階：綠色浴衣、黑色盤髮
            opts: { outfit: 'yukata', top: '#3f5a4a', accent: '#d9a7b0', hair: '#17110d', hairStyle: 'bun', skin: '#e3bf9c' },
            path: [landAt(stepX - 0.6, 1.8), new THREE.Vector3(stepX, 0.75, stepEdge - 0.35), new THREE.Vector3(stepX, 0.49, stepEdge - 1.1), new THREE.Vector3(stepX, 0.23, stepEdge - 1.95)]
        },
        {   // 平石：紅 T 恤卡其褲、黑色捲髮
            opts: { outfit: 'tshirt', top: '#c0392b', bottom: '#a08d6a', hair: '#1a1410', hairStyle: 'curly', skin: '#5a3a26' },
            path: [landAt(slabX + 0.8, 2.0), new THREE.Vector3(slabX + 0.2, 0.6, slabEdge - 0.25), new THREE.Vector3(slabX, 0.31, slabEdge - 1.25)]
        }
    ];
    const releasers = releaserDefs.map((def) => ({
        person: place({ ...def.opts, holding: true }, def.path[0], Math.PI),
        out: def.path,
        back: [...def.path].reverse(),
        state: 'idle',
        timer: rand(1, 6),
        count: 0,
        pending: false
    }));

    // 棧橋上一家人：在棧橋上來回散步（小孩跟著大人）
    const pierA = new THREE.Vector3(PIER.x + 0.45, deck, PIER.tipZ + 2.8);
    const pierB = new THREE.Vector3(PIER.x + 0.45, deck, PIER.rootZ - 1.5);
    const strollers = [];
    const followers = [];
    const parent = place({ outfit: 'suit', top: '#2b2f36', bottom: '#2b2f36', accent: '#9b2335', hair: '#a9a9a9', hairStyle: 'short', skin: '#c99a6e' }, pierA);
    strollers.push({ person: parent, points: [pierB, pierA], i: 0, wait: rand(2, 6) });
    followers.push({
        person: place({ outfit: 'tshirt', top: '#f2c14e', bottom: '#3b5998', shorts: true, hair: '#2a1a12', hairStyle: 'curly', skin: '#8d5a3b', scale: 0.62 }, pierA.clone().add(new THREE.Vector3(0.42, 0, 0.2))),
        leader: parent,
        offset: new THREE.Vector3(0.42, 0, 0.2)
    });

    // 棧橋尖端：穿白浴衣、手托水燈，靜靜看著水面
    place({ outfit: 'yukata', top: '#e6e0d4', accent: '#b8322c', hair: '#17110d', hairStyle: 'bun', skin: '#e3bf9c', holding: true },
        new THREE.Vector3(PIER.x + 0.65, deck, PIER.tipZ + 1.2), -0.15);

    // 岸上沿著水邊散步的人
    const shoreWalker = place({ outfit: 'tshirt', top: '#2e8b57', bottom: '#2d3446', hair: '#17110d', hairStyle: 'long', skin: '#5a3a26' }, landAt(-16, 1.6));
    strollers.push({ person: shoreWalker, points: [landAt(-26, 1.8), landAt(-11, 1.4), landAt(-16, 2.4)], i: 0, wait: rand(1, 4) });
    const mother = place({ outfit: 'dress', top: '#5b4a6b', bottom: '#5b4a6b', hair: '#17110d', hairStyle: 'long', skin: '#c99a6e' }, landAt(29, 2.1));
    strollers.push({ person: mother, points: [landAt(36, 2.4), landAt(27, 1.8)], i: 0, wait: rand(3, 8) });
    followers.push({
        person: place({ outfit: 'dress', top: '#9ec9e8', bottom: '#9ec9e8', hair: '#d9b56a', hairStyle: 'long', skin: '#f1d3bd', scale: 0.65 }, landAt(28.5, 2.0)),
        leader: mother,
        offset: new THREE.Vector3(-0.5, 0, 0.15)
    });

    // 站著看湖的人（手上托著水燈或空手）
    place({ outfit: 'suit', top: '#1f2f4f', bottom: '#1f2f4f', accent: '#c8a26a', hair: '#6b4226', hairStyle: 'short', skin: '#f1d3bd', holding: true }, landAt(stepX + 1.6, 1.1), -0.3);
    place({ outfit: 'yukata', top: '#d97a6a', accent: '#3a2a4a', hair: '#d9b56a', hairStyle: 'bun', skin: '#f1d3bd', holding: true }, landAt(-15.3, 1.7), 0.1);
    place({ outfit: 'dress', top: '#7a1f3d', bottom: '#7a1f3d', hair: '#9c4a22', hairStyle: 'long', skin: '#f1d3bd' }, landAt(PIER.x - 2.8, 1.4), 0.25);
    place({ outfit: 'tshirt', top: '#f4f1ea', bottom: '#56606e', shorts: true, hair: '#4a2e1c', hairStyle: 'buzz', skin: '#e0b48f' }, landAt(PIER.x + 3.2, 1.2), -0.2);

    scene.add(group);

    const queue = [];          // 漂遠後回到岸邊、等著被再放一次的水燈
    const _hand = new THREE.Vector3();

    function nextLantern() {
        while (queue.length) {
            const lantern = queue.shift();
            if (lantern.removed) continue;
            if (lantern.retired) {
                lantern.dispose();
                continue;
            }
            return lantern;
        }
        return null;
    }

    function updateReleaser(r, dt) {
        const p = r.person;
        const arrived = stepAlongPath(p, dt);
        switch (r.state) {
            case 'idle':
                p.crouchTarget = 0;
                p.held.visible = queue.length > 0;
                r.timer -= dt;
                if (r.timer <= 0) {
                    walkTo(p, r.out);
                    r.state = 'out';
                }
                break;
            case 'out':
                if (arrived) {
                    p.faceYaw = 0;
                    p.crouchTarget = 1;
                    r.state = 'crouch';
                    r.timer = 1.1;
                    r.count = 0;
                }
                break;
            case 'crouch':
                r.timer -= dt;
                if (r.timer <= 0) {
                    r.state = 'release';
                    r.timer = 0;
                }
                break;
            case 'release': {
                r.timer -= dt;
                const limit = queue.length > 6 ? 8 : 4;
                if (r.pending && p.releaseT > 0.85) {
                    // 手伸到最低點時，水燈離手落水
                    const lantern = nextLantern();
                    if (lantern) {
                        p.held.getWorldPosition(_hand);
                        lantern.launchAt(_hand.x, _hand.y, _hand.z - 0.15);
                    }
                    p.held.visible = false;
                    r.pending = false;
                }
                if (r.timer <= 0 && !r.pending) {
                    if (queue.length > 0 && r.count < limit) {
                        // 從身旁再拿起一盞，接著放
                        p.held.visible = true;
                        p.releaseT = 0;
                        r.pending = true;
                        r.count += 1;
                        r.timer = 3.2;
                    } else if (r.count === 0 && !r.touched) {
                        // 沒有水燈可放時，伸手碰碰水面
                        p.releaseT = 0;
                        r.touched = true;
                        r.timer = 2.8;
                    } else {
                        r.state = 'rise';
                        p.crouchTarget = 0;
                        r.timer = 1.1;
                    }
                }
                break;
            }
            case 'rise':
                r.timer -= dt;
                if (r.timer <= 0) {
                    walkTo(p, r.back);
                    r.state = 'back';
                }
                break;
            case 'back':
                if (arrived) {
                    p.faceYaw = 0;
                    r.state = 'idle';
                    r.timer = rand(5, 12);
                    r.touched = false;
                }
                break;
        }
    }

    const _follow = new THREE.Vector3();

    return {
        edge: shoreEdge,

        // 地面高度（給鏡頭用，避免鑽進岸裡）
        groundAt(x, z) {
            const d = z - shoreEdge(x);
            if (d >= -0.7) return d >= 0 ? landHeight(x, d) : LAND_Y * 0.5;
            if (Math.abs(x - PIER.x) < PIER.halfW && z > PIER.tipZ) return PIER.deckY;
            return 0;
        },

        isWater(x, z) {
            if (z > shoreEdge(x) - 0.9) return false;
            if (Math.abs(x - PIER.x) < PIER.halfW + 0.3 && z > PIER.tipZ - 0.3) return false;
            return true;
        },

        // 水燈不會漂上岸或穿過棧橋
        keepInWater(lantern) {
            const edge = shoreEdge(lantern.x) - 1.1;
            if (lantern.z > edge) {
                lantern.z = edge;
                lantern.vz = Math.min(lantern.vz, 0);
            }
            const dx = lantern.x - PIER.x;
            const clearance = PIER.halfW + 0.35;
            if (lantern.z > PIER.tipZ + 0.1 && Math.abs(dx) < clearance) {
                lantern.x = PIER.x + Math.sign(dx || 1) * clearance;
            }
        },

        // 漂遠的水燈先藏起來，排隊等岸邊的人再放一次
        enqueue(lantern) {
            lantern.waiting = true;
            lantern.setVisible(false);
            queue.push(lantern);
        },

        update(dt, t, night) {
            for (const r of releasers) updateReleaser(r, dt);
            for (const s of strollers) {
                if (stepAlongPath(s.person, dt)) {
                    s.wait -= dt;
                    if (s.wait <= 0) {
                        walkTo(s.person, [s.points[s.i]]);
                        s.i = (s.i + 1) % s.points.length;
                        s.wait = rand(4, 10);
                    }
                }
            }
            for (const f of followers) {
                // 跟在大人身旁：大人走就跟著走，停下來就一起看湖
                _follow.copy(f.offset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, f.leader.root.rotation.y).add(f.leader.root.position);
                const gap = Math.hypot(_follow.x - f.person.root.position.x, _follow.z - f.person.root.position.z);
                if (gap > 0.25) {
                    f.person.path = [_follow.clone()];
                    f.person.pathIndex = 0;
                    f.person.speed = f.leader.speed * 1.15;
                }
                stepAlongPath(f.person, dt);
                if (!f.person.path) f.person.faceYaw = f.leader.root.rotation.y;
            }
            for (const person of people) {
                person.look = 0.35 * Math.sin(t * 0.13 + person.seed);
                animatePerson(person, dt, t);
                const held = person.held;
                if (held) {
                    held.userData.paper.material.color.set('#ffe6b8').multiplyScalar(lerp(0.75, 0.8, night) * (1 + 0.08 * flicker(t, person.seed)));
                    held.userData.glow.material.opacity = lerp(0.25, 0.45, night);
                }
            }
            for (const lamp of workLights) updateWorkLight(lamp, night);
            for (const lamp of lamps) updateHurricaneLamp(lamp, t, night);
        }
    };
}

// ---------------------------------------------------------------------------
// 資料：Supabase / localStorage
// ---------------------------------------------------------------------------

const store = {
    client: null,
    total: 0,
    online: false,   // 最近一次讀寫 Supabase 是否成功

    async init() {
        try {
            const { createClient } = await import(SUPABASE_MODULE);
            this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (error) {
            console.warn('Supabase 載入失敗，改用本地儲存', error);
            this.client = null;
        }
    },

    readLocal() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            return Array.isArray(list) ? list.filter((w) => w && w.message) : [];
        } catch {
            return [];
        }
    },

    writeLocal(list) {
        try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
        } catch {
            // 無痕模式等情況下寫不進去，忽略即可
        }
    },

    async load(limit) {
        if (this.client) {
            try {
                const { data, error, count } = await this.client
                    .from(TABLE)
                    .select('id, message', { count: 'exact' })
                    .order('id', { ascending: false })
                    .limit(limit);
                if (!error && Array.isArray(data)) {
                    this.total = count ?? data.length;
                    this.online = true;
                    return data.reverse();
                }
                console.warn('讀取 Supabase 失敗', error);
            } catch (error) {
                console.warn('讀取 Supabase 失敗', error);
            }
        }
        this.online = false;
        const local = this.readLocal();
        this.total = local.length;
        return local.slice(-limit);
    },

    // 為了和舊版（2D）共用同一張表，欄位照舊填入；座標換算成舊版畫布座標
    async add(message, x, z) {
        const row = {
            baseX: 400 + x * 6,
            baseY: 600 + z * 3,
            message: message.slice(0, 140),
            angle: Math.random() * Math.PI * 2,
            floatSpeed: 0.03,
            bobAmount: 3,
            driftSpeed: 0.15,
            driftAngle: Math.random() * Math.PI * 2,
            time: 0,
            rotationSpeed: 0,
            depth: 0.5
        };
        this.total += 1;
        if (this.client) {
            try {
                const { data, error } = await this.client.from(TABLE).insert([row]).select('id').single();
                if (!error && data?.id) {
                    this.online = true;
                    return data.id;
                }
                console.warn('寫入 Supabase 失敗，改存本地', error);
            } catch (error) {
                console.warn('寫入 Supabase 失敗，改存本地', error);
            }
        }
        this.online = false;
        const local = this.readLocal();
        const id = local.reduce((m, w) => Math.max(m, Number(w.id) || 0), 0) + 1;
        local.push({ id, message, timestamp: new Date().toISOString() });
        this.writeLocal(local);
        return id;
    }
};

// ---------------------------------------------------------------------------
// 主程式
// ---------------------------------------------------------------------------

const ui = {
    body: document.body,
    canvas: document.getElementById('scene'),
    releaseBtn: document.getElementById('releaseBtn'),
    count: document.getElementById('count'),
    cancelPlaceBtn: document.getElementById('cancelPlaceBtn'),
    form: document.getElementById('wishFormInner'),
    input: document.getElementById('wishInput'),
    cancelWishBtn: document.getElementById('cancelWishBtn'),
    card: document.getElementById('wishCard'),
    cardNo: document.querySelector('#wishCard .no'),
    cardMsg: document.querySelector('#wishCard .msg'),
    toast: document.getElementById('toast'),
    loader: document.getElementById('loader')
};

function showToast(text, ms = 2800) {
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

function updateCount() {
    const wishes = store.total > 0 ? `湖上已有 ${store.total} 個心願 · ` : '';
    ui.count.textContent = wishes + (store.online ? '雲端已連線' : '未連上雲端，心願只存在這台裝置');
}

function fail(message) {
    ui.loader.innerHTML = `<div style="max-width:320px;padding:24px;text-align:center;line-height:1.8;letter-spacing:.08em">${message}</div>`;
}

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
    fail('你的瀏覽器無法使用 WebGL，<br>請換用新版 Chrome / Safari / Edge 再試一次。');
    throw error;
}
const MAX_PIXEL_RATIO = Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2);
let pixelRatio = MAX_PIXEL_RATIO;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 160, 950);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 9000);
camera.position.set(3, 4.6, 35);

// 直式螢幕（手機）時加大視角，讓水平方向至少看得到約 50°，富士山不被裁掉
function fitCamera() {
    camera.aspect = innerWidth / innerHeight;
    const minHorizontal = THREE.MathUtils.degToRad(50);
    const vertical = 2 * Math.atan(Math.tan(minHorizontal / 2) / camera.aspect);
    camera.fov = clamp(THREE.MathUtils.radToDeg(vertical), 50, 72);
    camera.updateProjectionMatrix();
}
fitCamera();

const controls = new OrbitControls(camera, ui.canvas);
// 初始畫面：站在岸上、看向棧橋與湖面（重置時回到這裡）
const HOME_CAMERA = camera.position.clone();
const HOME_TARGET = new THREE.Vector3(-2, 1.8, -4);
controls.target.copy(HOME_TARGET);
// 網址可指定視角：?cam=相機x,y,z,目標x,y,z（方便分享某個畫面）
{
    const cam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
    if (cam?.length === 6 && cam.every(Number.isFinite)) {
        camera.position.set(cam[0], cam[1], cam[2]);
        controls.target.set(cam[3], cam[4], cam[5]);
    }
}
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// 左鍵拖曳旋轉、右鍵拖曳平移（沿著水面）、滾輪縮放
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.panSpeed = 1.0;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 1.1;
controls.zoomToCursor = true;   // 滾輪往游標指的地方拉近
controls.minDistance = 2.5;
controls.maxDistance = 320;
controls.minPolarAngle = THREE.MathUtils.degToRad(5);
controls.maxPolarAngle = THREE.MathUtils.degToRad(89);
controls.update();

// 光照
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0b1020, 1);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(hemiLight, dirLight, dirLight.target);

// 天空
const sky = createSky();
scene.add(sky);

// 遠山
const fuji = createFuji();
const ridgeFar = createRidge({ z: -470, base: 10, amp: 38, seed: 1.7, color: '#26324a', gapFloor: 0.35, gapInner: 120, gapOuter: 420 });
const ridgeNear = createRidge({ z: -330, base: 2, amp: 22, seed: 4.2, color: '#141c2c', gapFloor: 0.1, gapInner: 150, gapOuter: 380 });
scene.add(fuji, ridgeFar, ridgeNear);

// 水面
const water = new Water(new THREE.PlaneGeometry(8000, 8000), {
    textureWidth: IS_MOBILE ? 1024 : 2048,
    textureHeight: IS_MOBILE ? 1024 : 2048,
    waterNormals: createWaterNormals(256),
    sunDirection: new THREE.Vector3(0, 1, 0),
    sunColor: 0xffffff,
    waterColor: 0x0e1b30,
    distortionScale: 0.55,
    fog: true
});
// 原版 Water shader 會加一個固定的 0.1 灰，夜裡湖面會發白；改成跟水色走。湖面也調得比海面平靜一些。
water.material.fragmentShader = water.material.fragmentShader
    .replace('vec3( 0.1 ) + reflectionSample', 'waterColor * 0.35 + reflectionSample')
    .replace('vec3( 1.5, 1.0, 1.5 )', 'vec3( 0.9, 1.0, 0.9 )')
    // 原本扭曲量隨距離倒數放大，近處倒影會被扯歪；加上上限讓倒影對準實物
    .replace('( 0.001 + 1.0 / distance )', 'min( 0.001 + 1.0 / distance, 0.012 )');
water.material.uniforms.size.value = 1.6;
water.rotation.x = -Math.PI / 2;
scene.add(water);

const ripples = new Ripples(scene, 48);
const shore = createShore(scene);

// 後製：bloom 讓燭光與日月自然地暈開
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
if (IS_MOBILE) bloom.resolution.set(innerWidth / 2, innerHeight / 2);

// 時間與天色
let skyState = null;
function applySky() {
    skyState = computeSkyState(getHour());
    const s = skyState;
    const u = sky.material.uniforms;
    u.uTop.value.copy(s.top);
    u.uHorizon.value.copy(s.horizon);
    u.uCloud.value.copy(s.cloud);
    u.uSunDir.value.copy(s.sunDir);
    u.uSunGlow.value.copy(s.sunGlow);
    u.uMoonDir.value.copy(s.moonDir);
    u.uNight.value = s.night;

    scene.fog.color.copy(s.horizon);

    hemiLight.color.copy(s.top).lerp(s.horizon, 0.5).lerp(new THREE.Color(1, 1, 1), 0.3);
    hemiLight.groundColor.copy(s.water);
    hemiLight.intensity = s.hemi;

    // 白天用太陽打光，夜裡改成淡淡的月光
    const useSun = s.sunVisible > 0.05;
    const lightDir = useSun ? s.sunDir : s.moonDir;
    dirLight.position.copy(lightDir).multiplyScalar(500);
    dirLight.color.copy(s.light);
    dirLight.intensity = useSun ? lerp(0.2, 1.8, s.sunVisible) : 0.25;

    const wu = water.material.uniforms;
    wu.waterColor.value.copy(s.water);
    wu.sunDirection.value.copy(lightDir);
    wu.sunColor.value.copy(useSun ? s.sunGlow.clone().multiplyScalar(1.2) : new THREE.Color('#8b98c4').multiplyScalar(0.6));

    renderer.toneMappingExposure = lerp(1.0, 1.25, s.night);
    bloom.strength = lerp(0.55, 0.95, s.night);
}
applySky();

// 水燈們
const lanterns = [];

function spawnLantern(data, { x, z, release = false } = {}) {
    const lantern = new Lantern(scene, {
        id: data.id,
        message: data.message,
        x: x ?? rand(-45, 45),
        z: z ?? rand(LAKE.far + 20, SHORE_Z - 5)
    });
    if (release) lantern.release(1.0);
    lanterns.push(lantern);

    // 超過上限：讓最遠的老水燈漂走後就不再回來
    const active = lanterns.filter((l) => !l.retired && !l.removed);
    if (active.length > MAX_LANTERNS) {
        active.sort((a, b) => a.z - b.z)[0].retired = true;
    }
    return lantern;
}

async function loadWishes() {
    await store.init();
    let wishes = await store.load(MAX_LANTERNS);
    if (wishes.length === 0) {
        wishes = DEMO_WISHES.map((message, i) => ({ id: i + 1, message }));
    }
    const spawned = wishes.map((w) => spawnLantern(w));
    // 留幾盞在岸邊，讓岸上的人一開始就有水燈可以放
    const keep = Math.min(5, Math.floor(spawned.length / 4));
    spawned.sort(() => Math.random() - 0.5).slice(0, keep).forEach((l) => shore.enqueue(l));
    updateCount();
}

// ---------------------------------------------------------------------------
// 互動
// ---------------------------------------------------------------------------

let mode = 'idle'; // idle | writing | placing
let pendingWish = '';
let selected = null;
let hovered = null;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function setMode(next) {
    mode = next;
    ui.body.classList.toggle('writing', mode === 'writing');
    ui.body.classList.toggle('placing', mode === 'placing');
    if (mode !== 'idle') selectLantern(null);
}

function pickLantern(clientX, clientY) {
    pointerNdc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const targets = [];
    for (const l of lanterns) if (!l.removed && !l.waiting) targets.push(...l.pickables);
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.lantern : null;
}

function selectLantern(lantern) {
    selected = lantern;
    if (lantern) {
        ui.cardNo.textContent = `No. ${String(lantern.id).padStart(4, '0')}`;
        ui.cardMsg.textContent = lantern.message;
        ui.card.classList.add('show');
    } else {
        ui.card.classList.remove('show');
    }
}

async function placeAt(clientX, clientY) {
    pointerNdc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(waterPlane, point)) return;
    if (point.z < LAKE.far + 30 || Math.abs(point.x) > LAKE.halfWidth) {
        showToast('再近一點的水面吧');
        return;
    }
    if (!shore.isWater(point.x, point.z)) {
        showToast('請點在湖面上');
        return;
    }
    const message = pendingWish;
    pendingWish = '';
    setMode('idle');

    const lantern = spawnLantern({ id: '····', message }, { x: point.x, z: point.z, release: true });
    updateCount();
    setTimeout(() => showToast('願你的心願，隨水而去，平安抵達'), 1700);

    const id = await store.add(message, point.x, point.z);
    lantern.id = id;
    updateCount();
}

let downInfo = null;
ui.canvas.addEventListener('pointerdown', (e) => {
    downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
});
ui.canvas.addEventListener('pointerup', (e) => {
    if (!downInfo) return;
    const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
    const quick = performance.now() - downInfo.t < 600;
    downInfo = null;
    if (moved > 8 || !quick) return;

    if (mode === 'placing') {
        placeAt(e.clientX, e.clientY);
    } else if (mode === 'idle') {
        const lantern = pickLantern(e.clientX, e.clientY);
        selectLantern(lantern && lantern !== selected ? lantern : null);
    }
});

let hoverQueued = false;
ui.canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'idle' || hoverQueued || e.buttons) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
        hoverQueued = false;
        hovered = pickLantern(e.clientX, e.clientY);
        ui.body.classList.toggle('hovering', !!hovered);
    });
});

ui.releaseBtn.addEventListener('click', () => {
    setMode('writing');
    ui.input.value = '';
    setTimeout(() => ui.input.focus(), 50);
});

ui.cancelWishBtn.addEventListener('click', () => setMode('idle'));
ui.cancelPlaceBtn.addEventListener('click', () => {
    pendingWish = '';
    setMode('idle');
});

ui.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = ui.input.value.trim();
    if (!message) return;
    pendingWish = message;
    ui.input.blur();
    setMode('placing');
});

// ---------------------------------------------------------------------------
// 移動：鍵盤（WASD / 方向鍵 / Q E）、畫面上的方向鈕、雙擊水面飛過去
// ---------------------------------------------------------------------------

const MOVE_KEYS = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'up', PageUp: 'up', Space: 'up',
    KeyQ: 'down', PageDown: 'down'
};
const held = new Set();      // 目前按住的方向（鍵盤與按鈕共用）
let boost = false;
const moveVelocity = new THREE.Vector3();

// 平滑飛行（雙擊某處、重置）：鏡頭與注視點一起緩緩移到目的地
const fly = {
    active: false, t: 0, duration: 1,
    fromTarget: new THREE.Vector3(), fromCamera: new THREE.Vector3(),
    target: new THREE.Vector3(), camera: new THREE.Vector3()
};

// 可移動範圍：涵蓋整個湖、岸邊與遠山前方（放寬，只防止飛到場景外）
const TARGET_BOUNDS = new THREE.Box3(
    new THREE.Vector3(-420, 0, -720),
    new THREE.Vector3(420, 140, 140)
);

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _shift = new THREE.Vector3();
const _offset = new THREE.Vector3();

function isTyping(e) {
    return e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
}

function shiftView(delta) {
    camera.position.add(delta);
    controls.target.add(delta);
}

function flyTo(target, cameraPosition) {
    fly.fromTarget.copy(controls.target);
    fly.fromCamera.copy(camera.position);
    fly.target.copy(target);
    fly.camera.copy(cameraPosition);
    // 固定時長、頭尾緩動：遠近都在 1～2.5 秒內平順抵達
    const travel = Math.max(fly.fromCamera.distanceTo(fly.camera), fly.fromTarget.distanceTo(fly.target));
    fly.duration = clamp(0.9 + travel / 200, 1, 2.5);
    fly.t = 0;
    fly.active = true;
    controls.enableDamping = false;   // 飛行時不要殘留之前拖曳的慣性
    moveVelocity.set(0, 0, 0);
}

function cancelFly() {
    fly.active = false;
    controls.enableDamping = true;
}

function resetView() {
    selectLantern(null);
    flyTo(HOME_TARGET, HOME_CAMERA);
}

// 富士山的地表高度（避免鏡頭鑽進山裡）
function fujiHeight(x, z) {
    const r = Math.hypot(x - fuji.position.x, z - fuji.position.z) / 300;
    const s = (r - 0.045) / 0.955;
    if (s >= 1) return 0;
    return 125 * Math.pow(1 - clamp(s, 0, 1), 1.75) + fuji.position.y;
}

function groundHeight(x, z) {
    return Math.max(shore.groundAt(x, z), fujiHeight(x, z), 0);
}

function moveCamera(dt) {
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
    _forward.normalize();
    _right.crossVectors(_forward, THREE.Object3D.DEFAULT_UP);

    _wish.set(0, 0, 0);
    if (held.has('forward')) _wish.add(_forward);
    if (held.has('back')) _wish.sub(_forward);
    if (held.has('right')) _wish.add(_right);
    if (held.has('left')) _wish.sub(_right);
    if (held.has('up')) _wish.y += 0.7;
    if (held.has('down')) _wish.y -= 0.7;
    if (_wish.lengthSq() > 0) {
        // 離注視點越遠移動越快，近看時精細、遠看時不會慢吞吞
        const distance = camera.position.distanceTo(controls.target);
        const speed = clamp(distance * 0.5, 5, 70) * (boost ? 2.5 : 1);
        _wish.normalize().multiplyScalar(speed);
        cancelFly();
    }

    // 平滑加減速，放開按鍵時會慢慢停下
    const k = 1 - Math.exp(-dt * (_wish.lengthSq() > 0 ? 6 : 4));
    moveVelocity.lerp(_wish, k);
    if (moveVelocity.lengthSq() > 1e-4) {
        shiftView(_shift.copy(moveVelocity).multiplyScalar(dt));
    }

    if (fly.active) {
        fly.t += dt;
        const p = clamp(fly.t / fly.duration, 0, 1);
        const ease = p * p * p * (p * (p * 6 - 15) + 10);
        controls.target.lerpVectors(fly.fromTarget, fly.target, ease);
        camera.position.lerpVectors(fly.fromCamera, fly.camera, ease);
        if (p >= 1) cancelFly();
    }

    // 範圍限制用「柔性」拉回，不會突然卡住
    const excess = _shift.copy(controls.target).clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max).sub(controls.target);
    if (excess.lengthSq() > 0) {
        shiftView(excess.multiplyScalar(Math.min(1, dt * 8)));
        moveVelocity.multiplyScalar(0.9);
    }
    const minY = groundHeight(camera.position.x, camera.position.z) + 1.2;
    if (camera.position.y < minY) {
        camera.position.y = lerp(camera.position.y, minY, Math.min(1, dt * 12));
        if (camera.position.y < minY - 0.5) camera.position.y = minY - 0.5;
    }
}

addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        pendingWish = '';
        setMode('idle');
        return;
    }
    if (isTyping(e) || mode === 'writing' || e.metaKey || e.ctrlKey || e.altKey) return;
    boost = e.shiftKey;
    if (e.code === 'KeyR' || e.code === 'Home') {
        resetView();
        e.preventDefault();
        return;
    }
    const dir = MOVE_KEYS[e.code];
    if (dir) {
        held.add(dir);
        e.preventDefault(); // 避免方向鍵 / 空白鍵捲動頁面
    }
});

addEventListener('keyup', (e) => {
    boost = e.shiftKey;
    const dir = MOVE_KEYS[e.code];
    if (dir) held.delete(dir);
});

// 視窗失焦時放開所有按鍵，避免鏡頭一直滑走
addEventListener('blur', () => held.clear());

// 使用者自己拖曳或滾輪時，取消進行中的飛行
ui.canvas.addEventListener('pointerdown', cancelFly);
ui.canvas.addEventListener('wheel', cancelFly, { passive: true });

// 畫面上的方向鈕：按住持續移動
document.querySelectorAll('#movePad [data-dir]').forEach((btn) => {
    const dir = btn.dataset.dir;
    const release = () => {
        held.delete(dir);
        btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        held.add(dir);
        btn.classList.add('active');
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
});

document.getElementById('resetBtn').addEventListener('click', resetView);

// 雙擊畫面上任何看得到的地方（水面、岸、棧橋、山…），就飛過去
ui.canvas.addEventListener('dblclick', (e) => {
    if (mode !== 'idle') return;
    pointerNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(scene.children, true).find((h) =>
        h.object !== sky && !h.object.isSprite && h.object.visible &&
        h.object.material?.blending !== THREE.AdditiveBlending);
    if (!hit) return;
    const point = hit.point.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max);
    // 保持目前的觀看方向，距離拉近一些
    _offset.subVectors(camera.position, controls.target);
    const distance = clamp(Math.min(_offset.length(), hit.distance) * 0.6, 6, 80);
    _offset.normalize().multiplyScalar(distance);
    flyTo(point, point.clone().add(_offset));
});

// 右鍵用來平移，不要跳出瀏覽器選單
ui.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const helpToggle = document.getElementById('helpToggle');
helpToggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('help-open');
    helpToggle.setAttribute('aria-expanded', String(open));
    try {
        localStorage.setItem('toroHelpClosed', open ? '0' : '1');
    } catch {
        // 忽略
    }
});
try {
    if (localStorage.getItem('toroHelpClosed') !== '1' && !IS_MOBILE) {
        document.body.classList.add('help-open');
        helpToggle.setAttribute('aria-expanded', 'true');
    }
} catch {
    // 忽略
}

addEventListener('resize', () => {
    fitCamera();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    if (IS_MOBILE) bloom.resolution.set(innerWidth / 2, innerHeight / 2);
});

// ---------------------------------------------------------------------------
// 動畫迴圈
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
const anchor = new THREE.Vector3();
let elapsed = 0;
let skyTimer = 0;
let firstFrame = true;

function separate() {
    // 水燈彼此輕輕推開，不會疊在一起
    const minDist = 0.9;
    for (let i = 0; i < lanterns.length; i++) {
        const a = lanterns[i];
        a.pushX = 0;
        a.pushZ = 0;
    }
    for (let i = 0; i < lanterns.length; i++) {
        const a = lanterns[i];
        if (a.waiting) continue;
        for (let j = i + 1; j < lanterns.length; j++) {
            const b = lanterns[j];
            if (b.waiting) continue;
            const dx = a.x - b.x;
            const dz = a.z - b.z;
            if (Math.abs(dx) > minDist || Math.abs(dz) > minDist) continue;
            const d = Math.hypot(dx, dz) || 0.01;
            if (d < minDist) {
                const f = ((minDist - d) / minDist) * 0.5;
                a.pushX += (dx / d) * f;
                a.pushZ += (dz / d) * f;
                b.pushX -= (dx / d) * f;
                b.pushZ -= (dz / d) * f;
            }
        }
    }
}

// 依實際幀率自動調整解析度：卡頓時降一點，順暢時再調回來
let fpsTime = 0;
let fpsFrames = 0;
function adaptQuality(dt) {
    fpsTime += dt;
    fpsFrames += 1;
    if (fpsTime < 1.5) return;
    const fps = fpsFrames / fpsTime;
    fpsTime = 0;
    fpsFrames = 0;
    let next = pixelRatio;
    if (fps < 40) next = Math.max(0.6, pixelRatio - 0.2);
    else if (fps > 57) next = Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.1);
    if (Math.abs(next - pixelRatio) > 0.01) {
        pixelRatio = next;
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
        composer.setSize(innerWidth, innerHeight);
    }
}

function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    skyTimer += dt;
    if (skyTimer > 30) {
        skyTimer = 0;
        applySky();
    }

    // 鏡頭像呼吸一樣極輕微地晃動
    moveCamera(dt);
    controls.update();

    sky.position.copy(camera.position);
    sky.material.uniforms.uTime.value = elapsed;
    water.material.uniforms.time.value = elapsed * 0.45;

    separate();
    const ctx = {
        cameraPos: camera.position,
        night: skyState.night,
        ripples,
        shore,
        pushX: 0,
        pushZ: 0
    };
    for (const l of lanterns) {
        ctx.pushX = l.pushX;
        ctx.pushZ = l.pushZ;
        l.update(dt, elapsed, ctx);
    }
    for (let i = lanterns.length - 1; i >= 0; i--) {
        if (lanterns[i].removed) {
            if (lanterns[i] === selected) selectLantern(null);
            lanterns.splice(i, 1);
        }
    }
    ripples.update(dt, lerp(0.5, 1, skyState.night));
    shore.update(dt, elapsed, skyState.night);

    // 心願卡片跟著選中的水燈移動
    if (selected?.waiting) selectLantern(null);
    if (selected) {
        selected.worldAnchor(anchor).project(camera);
        if (anchor.z > 1) {
            selectLantern(null);
        } else {
            const x = (anchor.x * 0.5 + 0.5) * innerWidth;
            const y = (-anchor.y * 0.5 + 0.5) * innerHeight;
            const w = ui.card.offsetWidth;
            const h = ui.card.offsetHeight;
            const left = clamp(x - w / 2, 12, innerWidth - w - 12);
            const top = clamp(y - h - 14, 12, innerHeight - h - 12);
            ui.card.style.transform = `translate(${left}px, ${top}px)`;
        }
    }

    composer.render();
    adaptQuality(dt);

    if (firstFrame) {
        firstFrame = false;
        ui.loader.classList.add('done');
    }
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
loadWishes();
