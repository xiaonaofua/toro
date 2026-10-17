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
// 水燈整體縮放：和岸上的人比起來大約是一個小木盒的大小
const LANTERN_SCALE = 0.55;

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
        this.glow.scale.setScalar(2.1);

        this.pool = new THREE.Mesh(POOL_GEOMETRY, new THREE.MeshBasicMaterial({
            map: POOL_TEXTURE,
            color: glowColor,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            fog: false
        }));
        this.pool.scale.setScalar(3.8);

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

    // 漂遠後，由岸邊蹲著的人重新放下水
    respawnFromShore(shore) {
        const spot = shore.takeReleaseSpot();
        this.x = spot.x;
        this.z = spot.z;
        this.vx = 0;
        this.vz = -0.25;
        this.release(spot.height);
    }

    update(dt, t, ctx) {
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
                    ctx.ripples.spawn(this.x, this.z, 0.55, 1.3);
                    ctx.ripples.spawn(this.x, this.z, 0.35, 0.8, 0.5);
                    ctx.ripples.spawn(this.x, this.z, 0.2, 0.5, 1.1);
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
        this.glow.position.set(this.x, y + 0.42, this.z);
        this.glow.material.opacity = 0.9 * bright * glowBoost * distanceFade;
        this.glow.scale.setScalar(2.0 + 0.15 * f);
        this.pool.position.set(this.x, 0.03, this.z);
        this.pool.material.opacity = 0.32 * bright * glowBoost * distanceFade;

        // 偶爾泛起一圈漣漪
        this.nextRipple -= dt;
        if (this.nextRipple <= 0) {
            this.nextRipple = rand(5, 11);
            if (distance < 120) ctx.ripples.spawn(this.x, this.z, 0.12, 0.9);
        }

        // 漂到遠處：退役的水燈消失，其他水燈回到近岸重新出發
        if (this.z < LAKE.far) {
            if (this.retired) {
                this.dispose();
            } else {
                this.respawnFromShore(ctx.shore);
            }
        }
    }

    worldAnchor(target) {
        return target.set(this.x, this.group.position.y + 1.0, this.z);
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
            item.mesh.scale.setScalar(0.9 + p * 6 * item.size);
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

// 提燈：紅色或白色的紙燈籠，發光並照亮附近
function createChochin(size, color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), new THREE.MeshBasicMaterial({ color }));
    body.scale.y = 1.25;
    const capGeo = new THREE.CylinderGeometry(size * 0.55, size * 0.55, size * 0.18, 12);
    const top = new THREE.Mesh(capGeo, lambert('#1b1512'));
    top.position.y = size * 1.22;
    const bottom = top.clone();
    bottom.position.y = -size * 1.22;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW_TEXTURE,
        color: new THREE.Color(color).lerp(new THREE.Color('#ffb874'), 0.5),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false
    }));
    glow.scale.setScalar(size * 9);
    group.add(body, top, bottom, glow);
    group.userData = { body, glow, baseColor: new THREE.Color(color), seed: rand(0, 100) };
    return group;
}

function updateChochin(lamp, t, night) {
    const { body, glow, baseColor, seed } = lamp.userData;
    const f = 1 + 0.06 * flicker(t * 0.8, seed);
    body.material.color.copy(baseColor).multiplyScalar(lerp(0.75, 1.25, night) * f);
    glow.material.opacity = lerp(0.25, 0.85, night) * f;
}

function createPolePost(x, z, color) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.9, 6), lambert('#2a1f17'));
    pole.position.y = 1.45;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), lambert('#2a1f17'));
    arm.position.set(0, 2.85, -0.28);
    const lamp = createChochin(0.24, color);
    lamp.position.set(0, 2.45, -0.55);
    const light = new THREE.PointLight('#ffb070', 0, 16, 1.4);
    light.position.set(0, 2.3, -0.6);
    group.add(pole, arm, lamp, light);
    group.position.set(x, 0, z);
    group.userData = { lamp, light };
    return group;
}

// 迷你水燈（蹲著的人手上捧著的那一盞）
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
    glow.scale.setScalar(2.0 / LANTERN_SCALE);
    glow.position.y = 0.8;
    group.add(glow);
    group.userData = { paper, glow };
    return group;
}

// 岸上的人（低多邊形、風格化）。面向 -z（看向湖）。
// outfit：yukata 浴衣 / suit 西裝 / tshirt T 恤 / dress 洋裝
// hairStyle：bun 盤髮 / short 短髮 / long 長髮 / curly 捲髮 / buzz 平頭
function createPerson({
    pose = 'stand', outfit = 'yukata', top, bottom = '#2d3446', accent = '#e8c35a',
    hair = '#17110d', hairStyle = 'short', skin = '#e3bf9c', shorts = false, scale = 1, holding = null
}) {
    const root = new THREE.Group();
    const add = (geometry, color, x, y, z, parent = root) => {
        const mesh = new THREE.Mesh(geometry, lambert(color));
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    };
    const shoe = outfit === 'yukata' ? '#2a2018' : outfit === 'suit' ? '#141110' : '#e6e2da';

    const addHead = (parent, y) => {
        add(new THREE.SphereGeometry(0.125, 14, 10), skin, 0, y, 0, parent);
        const cap = { buzz: 0.42, short: 0.55, bun: 0.55, long: 0.58, curly: 0.6 }[hairStyle] ?? 0.55;
        const r = hairStyle === 'buzz' ? 0.128 : 0.134;
        add(new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * cap), hair, 0, y + 0.012, 0.012, parent);
        if (hairStyle === 'bun') add(new THREE.SphereGeometry(0.06, 10, 8), hair, 0, y + 0.1, 0.09, parent);
        if (hairStyle === 'long') add(new THREE.BoxGeometry(0.24, 0.32, 0.08), hair, 0, y - 0.1, 0.1, parent);
        if (hairStyle === 'curly') {
            for (let i = 0; i < 7; i++) {
                const a = (i / 7) * Math.PI * 2;
                add(new THREE.SphereGeometry(0.06, 8, 6), hair, Math.cos(a) * 0.1, y + 0.07, Math.sin(a) * 0.1 + 0.02, parent);
            }
        }
    };

    // 手臂：浴衣是寬袖，西裝是長袖，T 恤是短袖露出前臂
    const addArm = (parent, side, x, y, z, swing) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * x, y, z);
        pivot.rotation.set(swing, 0, side * 0.08);
        if (outfit === 'yukata') {
            add(new THREE.BoxGeometry(0.13, 0.42, 0.24), top, 0, -0.2, 0.02, pivot);
        } else if (outfit === 'suit') {
            add(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 8), top, 0, -0.2, 0, pivot);
        } else {
            add(new THREE.CylinderGeometry(0.065, 0.062, 0.16, 8), top, 0, -0.07, 0, pivot);
            add(new THREE.CylinderGeometry(0.045, 0.04, 0.3, 8), skin, 0, -0.29, 0, pivot);
        }
        add(new THREE.SphereGeometry(0.045, 8, 6), skin, 0, -0.45, -0.02, pivot);
        parent.add(pivot);
        return pivot;
    };

    // 上半身（腰帶 / 皮帶 + 軀幹 + 領口細節）
    const addTorso = (parent, y0) => {
        if (outfit === 'yukata') {
            add(new THREE.CylinderGeometry(0.205, 0.2, 0.16, 12), accent, 0, y0, 0, parent);
            add(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), top, 0, y0 + 0.25, 0, parent);
            return;
        }
        if (outfit !== 'dress') add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), outfit === 'suit' ? '#111' : '#3a2c22', 0, y0 - 0.02, 0, parent);
        add(new THREE.CylinderGeometry(0.2, 0.17, 0.44, 12), top, 0, y0 + 0.22, 0, parent);
        if (outfit === 'suit') {
            add(new THREE.BoxGeometry(0.1, 0.22, 0.02), '#f2f0ea', 0, y0 + 0.32, -0.19, parent);
            add(new THREE.BoxGeometry(0.035, 0.2, 0.02), accent, 0, y0 + 0.3, -0.2, parent);
        }
    };

    const person = { root, pose, arms: [], upper: null, held: null, releaseT: -1, seed: rand(0, 100) };

    if (pose === 'crouch') {
        const lowerColor = outfit === 'yukata' || outfit === 'dress' ? (outfit === 'yukata' ? top : bottom) : bottom;
        const skirt = add(new THREE.CylinderGeometry(0.24, 0.32, 0.42, 12), lowerColor, 0, 0.21, 0.02);
        skirt.scale.z = 1.25;
        for (const s of [-1, 1]) {
            add(new THREE.SphereGeometry(0.13, 10, 8), lowerColor, s * 0.12, 0.42, -0.2);
            if (outfit !== 'yukata') add(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoe, s * 0.12, 0.035, -0.12);
        }
        const upper = new THREE.Group();
        upper.position.set(0, 0.42, 0.02);
        upper.rotation.x = -0.5;
        addTorso(upper, 0.07);
        addHead(upper, 0.62);
        for (const s of [-1, 1]) person.arms.push(addArm(upper, s, 0.23, 0.45, 0, 1.4));
        root.add(upper);
        person.upper = upper;
        if (holding === 'toro') {
            person.held = createHeldToro();
            person.held.position.set(0, 0.33, -0.62);
            root.add(person.held);
        }
    } else {
        for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoe, s * 0.09, 0.035, -0.03);
        if (outfit === 'yukata') {
            add(new THREE.CylinderGeometry(0.19, 0.27, 1.0, 12), top, 0, 0.55, 0);
        } else if (outfit === 'dress') {
            for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 8), skin, s * 0.08, 0.3, 0);
            add(new THREE.CylinderGeometry(0.18, 0.3, 0.5, 14), bottom, 0, 0.78, 0);
        } else {
            for (const s of [-1, 1]) {
                const legX = s * 0.085;
                if (shorts) {
                    add(new THREE.CylinderGeometry(0.075, 0.072, 0.32, 8), bottom, legX, 0.86, 0);
                    add(new THREE.CylinderGeometry(0.055, 0.05, 0.62, 8), skin, legX, 0.38, 0);
                } else {
                    add(new THREE.CylinderGeometry(0.078, 0.07, 0.96, 8), bottom, legX, 0.54, 0);
                }
            }
        }
        addTorso(root, 1.0);
        const upper = new THREE.Group();
        addHead(upper, 1.6);
        root.add(upper);
        person.upper = upper;
        person.arms.push(addArm(root, -1, 0.24, 1.4, 0, 0.12));
        person.arms.push(addArm(root, 1, 0.24, 1.4, 0, holding === 'chochin' ? 0.55 : 0.12));
        if (holding === 'chochin') {
            const stick = add(new THREE.BoxGeometry(0.02, 0.02, 0.32), '#2a1f17', 0.24, 1.0, -0.36);
            stick.rotation.x = 0.2;
            person.held = createChochin(0.1, Math.random() < 0.5 ? '#ff7a4a' : '#fff0d0');
            person.held.position.set(0.24, 0.83, -0.5);
            root.add(person.held);
        }
    }
    root.scale.setScalar(scale);
    return person;
}

function updatePerson(person, dt, t) {
    const sway = Math.sin(t * 0.7 + person.seed);
    if (person.pose === 'crouch') {
        // 放燈動作：身體再往前傾、雙手往水面送出去，然後慢慢收回
        let reach = 0;
        if (person.releaseT >= 0) {
            person.releaseT += dt;
            const p = person.releaseT;
            reach = p < 0.9 ? smoothstep(0, 0.9, p) : 1 - smoothstep(1.4, 3.2, p);
            if (p > 3.2) person.releaseT = -1;
        }
        person.upper.rotation.x = -0.5 - 0.22 * reach + 0.015 * sway;
        person.arms.forEach((arm) => { arm.rotation.x = 1.4 + 0.45 * reach; });
    } else {
        person.root.rotation.z = 0.012 * sway;
        person.upper.rotation.y = 0.25 * Math.sin(t * 0.13 + person.seed);
    }
    if (person.held?.userData.body) {
        person.held.rotation.z = 0.08 * Math.sin(t * 1.3 + person.seed);
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

    // 燈籠柱
    const posts = [
        createPolePost(PIER.x + 1.5, PIER.rootZ - 1, '#ff7a4a'),
        createPolePost(14, shoreEdge(14) + 1.6, '#fff0d0'),
        createPolePost(-19, shoreEdge(-19) + 2.2, '#ff7a4a'),
        createPolePost(31, shoreEdge(31) + 2.4, '#ff7a4a')
    ];
    posts[0].position.y = PIER.deckY;
    posts.slice(1).forEach((p) => { p.position.y = LAND_Y; });
    group.add(...posts);

    // 人
    const people = [];
    const place = (opts, x, y, z, yaw = 0) => {
        const person = createPerson(opts);
        person.root.position.set(x, y, z);
        person.root.rotation.y = yaw;
        group.add(person.root);
        people.push(person);
        return person;
    };
    const deck = PIER.deckY + 0.035;
    const releasers = [
        // 棧橋尖端：金髮、藍 T 恤配牛仔褲
        { person: place({ pose: 'crouch', outfit: 'tshirt', top: '#2f6db5', bottom: '#33415c', hair: '#d9b56a', hairStyle: 'short', skin: '#f1d3bd', holding: 'toro' }, PIER.x - 0.4, deck, PIER.tipZ + 0.55), height: deck + 0.25 },
        // 石階：綠色浴衣、黑色盤髮
        { person: place({ pose: 'crouch', outfit: 'yukata', top: '#3f5a4a', accent: '#d9a7b0', hair: '#17110d', hairStyle: 'bun', skin: '#e3bf9c', holding: 'toro' }, stepX, 0.23, stepEdge - 1.95), height: 0.5 },
        // 平石：紅 T 恤卡其褲、黑色捲髮
        { person: place({ pose: 'crouch', outfit: 'tshirt', top: '#c0392b', bottom: '#a08d6a', hair: '#1a1410', hairStyle: 'curly', skin: '#5a3a26', holding: 'toro' }, slabX, 0.31, slabEdge - 1.3, 0.2), height: 0.58 }
    ];
    // 棧橋上
    place({ pose: 'stand', outfit: 'yukata', top: '#e6e0d4', accent: '#b8322c', hair: '#17110d', hairStyle: 'bun', skin: '#e3bf9c', holding: 'chochin' }, PIER.x + 0.65, deck, PIER.tipZ + 1.4, -0.15);
    place({ pose: 'stand', outfit: 'suit', top: '#2b2f36', bottom: '#2b2f36', accent: '#9b2335', hair: '#a9a9a9', hairStyle: 'short', skin: '#c99a6e' }, PIER.x - 0.5, deck, PIER.tipZ + 5.2, 0.1);
    place({ pose: 'stand', outfit: 'tshirt', top: '#f2c14e', bottom: '#3b5998', shorts: true, hair: '#2a1a12', hairStyle: 'curly', skin: '#8d5a3b', scale: 0.62 }, PIER.x + 0.15, deck, PIER.tipZ + 5.4, -0.05);
    place({ pose: 'stand', outfit: 'dress', top: '#7a1f3d', bottom: '#7a1f3d', hair: '#9c4a22', hairStyle: 'long', skin: '#f1d3bd' }, PIER.x + 0.6, deck, PIER.tipZ + 8.2, -0.2);
    place({ pose: 'stand', outfit: 'tshirt', top: '#f4f1ea', bottom: '#56606e', shorts: true, hair: '#4a2e1c', hairStyle: 'buzz', skin: '#e0b48f' }, PIER.x - 0.55, deck, PIER.tipZ + 8.6, 0.25);
    // 岸上
    place({ pose: 'stand', outfit: 'suit', top: '#1f2f4f', bottom: '#1f2f4f', accent: '#c8a26a', hair: '#6b4226', hairStyle: 'short', skin: '#f1d3bd', holding: 'chochin' }, stepX + 1.6, LAND_Y, stepEdge + 1.1, -0.3);
    place({ pose: 'stand', outfit: 'tshirt', top: '#2e8b57', bottom: '#2d3446', hair: '#17110d', hairStyle: 'long', skin: '#5a3a26' }, -16, LAND_Y, shoreEdge(-16) + 1.6, 0.15);
    place({ pose: 'stand', outfit: 'yukata', top: '#d97a6a', accent: '#3a2a4a', hair: '#d9b56a', hairStyle: 'bun', skin: '#f1d3bd', holding: 'chochin' }, -15.3, LAND_Y, shoreEdge(-15.3) + 1.7, 0.1);
    place({ pose: 'stand', outfit: 'dress', top: '#5b4a6b', bottom: '#5b4a6b', hair: '#17110d', hairStyle: 'long', skin: '#c99a6e' }, 29, LAND_Y, shoreEdge(29) + 2.1, -0.4);
    place({ pose: 'stand', outfit: 'dress', top: '#9ec9e8', bottom: '#9ec9e8', hair: '#d9b56a', hairStyle: 'long', skin: '#f1d3bd', scale: 0.65 }, 28.4, LAND_Y, shoreEdge(28.4) + 2.0, -0.4);

    // 每個蹲著的人前方的放燈點（世界座標）
    releasers.forEach((r) => {
        const p = r.person.root.position;
        const yaw = r.person.root.rotation.y;
        r.x = p.x - Math.sin(yaw) * 0.62;
        r.z = p.z - Math.cos(yaw) * 0.62;
        r.cooldown = rand(0, 3);
        r.hiddenFor = 0;
    });

    scene.add(group);

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
            const clearance = PIER.halfW + 0.55;
            if (lantern.z > PIER.tipZ - 0.5 && Math.abs(dx) < clearance) {
                lantern.x = PIER.x + Math.sign(dx || 1) * clearance;
            }
        },

        takeReleaseSpot() {
            const r = releasers.reduce((best, cur) => (cur.cooldown < best.cooldown ? cur : best));
            r.cooldown = rand(5, 8);
            r.person.releaseT = 0;
            r.hiddenFor = 4;
            return { x: r.x + rand(-0.15, 0.15), z: r.z - 0.2, height: r.height };
        },

        update(dt, t, night) {
            for (const r of releasers) {
                r.cooldown -= dt;
                r.hiddenFor -= dt;
                if (r.person.held) r.person.held.visible = r.hiddenFor <= 0;
            }
            for (const person of people) {
                updatePerson(person, dt, t);
                const held = person.held;
                if (held?.userData.body) updateChochin(held, t, night);
                if (held?.userData.paper) {
                    held.userData.paper.material.color.set('#ffe6b8').multiplyScalar(lerp(0.85, 0.95, night) * (1 + 0.08 * flicker(t, person.seed)));
                    held.userData.glow.material.opacity = lerp(0.35, 0.65, night);
                }
            }
            for (const post of posts) {
                updateChochin(post.userData.lamp, t, night);
                post.userData.light.intensity = lerp(0.3, 7, night) * (1 + 0.05 * flicker(t, post.position.x));
            }
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
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));
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
const baseTarget = new THREE.Vector3(-2, 1.8, -4);
controls.target.copy(baseTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
// 左鍵拖曳旋轉、右鍵拖曳平移（沿著水面）、滾輪縮放
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.8;
controls.minDistance = 8;
controls.maxDistance = 110;
controls.minPolarAngle = THREE.MathUtils.degToRad(40);
controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-75);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(75);
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
    wishes.forEach((w) => spawnLantern(w));
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
    for (const l of lanterns) if (!l.removed) targets.push(...l.pickables);
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
const sway = new THREE.Vector3();
const lastSway = new THREE.Vector3();
let flyTarget = null;

// 可移動範圍：留在湖面上方，不會鑽到水下或飛出湖外
const TARGET_BOUNDS = new THREE.Box3(
    new THREE.Vector3(-LAKE.halfWidth, 0.8, LAKE.far + 15),
    new THREE.Vector3(LAKE.halfWidth, 25, 34)
);

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _shift = new THREE.Vector3();

function isTyping(e) {
    return e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
}

function shiftView(delta) {
    camera.position.add(delta);
    controls.target.add(delta);
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
    if (held.has('up')) _wish.y += 0.6;
    if (held.has('down')) _wish.y -= 0.6;
    if (_wish.lengthSq() > 0) {
        _wish.normalize().multiplyScalar(boost ? 30 : 12);
        flyTarget = null;
    }

    // 平滑加減速，放開按鍵時會慢慢停下
    const k = 1 - Math.exp(-dt * (_wish.lengthSq() > 0 ? 5 : 3.5));
    moveVelocity.lerp(_wish, k);
    if (moveVelocity.lengthSq() > 1e-4) {
        shiftView(_shift.copy(moveVelocity).multiplyScalar(dt));
    }

    // 雙擊水面後，平滑地滑過去
    if (flyTarget) {
        _shift.subVectors(flyTarget, controls.target);
        _shift.y = 0;
        if (_shift.length() < 0.2) {
            flyTarget = null;
        } else {
            shiftView(_shift.multiplyScalar(1 - Math.exp(-dt * 2.2)));
        }
    }

    // 限制範圍
    const clamped = _shift.copy(controls.target).clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max).sub(controls.target);
    if (clamped.lengthSq() > 0) shiftView(clamped);
    const minY = shore.groundAt(camera.position.x, camera.position.z) + 1.4;
    if (camera.position.y < minY) shiftView(_shift.set(0, minY - camera.position.y, 0));
}

addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        pendingWish = '';
        setMode('idle');
        return;
    }
    if (isTyping(e) || mode === 'writing' || e.metaKey || e.ctrlKey || e.altKey) return;
    boost = e.shiftKey;
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

ui.canvas.addEventListener('dblclick', (e) => {
    if (mode !== 'idle') return;
    pointerNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const point = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(waterPlane, point)) {
        flyTarget = point.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max);
    }
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
    const minDist = 1.4;
    for (let i = 0; i < lanterns.length; i++) {
        const a = lanterns[i];
        a.pushX = 0;
        a.pushZ = 0;
    }
    for (let i = 0; i < lanterns.length; i++) {
        const a = lanterns[i];
        for (let j = i + 1; j < lanterns.length; j++) {
            const b = lanterns[j];
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

function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    skyTimer += dt;
    if (skyTimer > 30) {
        skyTimer = 0;
        applySky();
    }

    // 鏡頭像呼吸一樣極輕微地晃動
    sway.set(Math.sin(elapsed * 0.07) * 0.6, Math.sin(elapsed * 0.11) * 0.15, 0);
    controls.target.add(sway).sub(lastSway);
    lastSway.copy(sway);
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

    if (firstFrame) {
        firstFrame = false;
        ui.loader.classList.add('done');
    }
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
loadWishes();
