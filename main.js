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

        const glowColor = new THREE.Color('#ffb874').lerp(tint, 0.2);
        this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: GLOW_TEXTURE,
            color: glowColor,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            fog: false
        }));
        this.glow.scale.setScalar(3.4);

        this.pool = new THREE.Mesh(POOL_GEOMETRY, new THREE.MeshBasicMaterial({
            map: POOL_TEXTURE,
            color: glowColor,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            fog: false
        }));
        this.pool.scale.setScalar(6.5);

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
        this.nextRipple = rand(2, 9);
        this.retired = false;
        this.removed = false;

        this._qTilt = new THREE.Quaternion();
        this._qYaw = new THREE.Quaternion();
        this._euler = new THREE.Euler();
    }

    release() {
        this.light = 0;
        this.drop = 1.6;
        this.dropTime = 0;
    }

    respawnNearShore(cameraZ) {
        this.x = rand(-38, 38);
        this.z = Math.max(cameraZ, 30) + rand(4, 12);
        this.vx = 0;
        this.vz = -0.3;
    }

    update(dt, t, ctx) {
        // 漂流：速度慢慢追上水流（有慣性）
        const flow = flowAt(this.x, this.z, t);
        this.vx = damp(this.vx, flow.vx * this.speed + ctx.pushX, 0.6, dt);
        this.vz = damp(this.vz, flow.vz * this.speed + ctx.pushZ, 0.6, dt);
        if (this.dropTime < 0 || this.dropTime > 1.5) {
            this.x += this.vx * dt;
            this.z += this.vz * dt;
        }
        this.x = clamp(this.x, -LAKE.halfWidth, LAKE.halfWidth);

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
            const p = clamp(this.dropTime / 1.6, 0, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            this.drop = 1.6 * (1 - ease);
            if (p >= 1) {
                const s = this.dropTime - 1.6;
                settle = 0.12 * Math.exp(-s * 1.4) * Math.sin(s * 6);
                this.tiltX += 0.06 * Math.exp(-s * 1.2) * Math.sin(s * 4.3) * dt * 10;
                if (!this.splashed) {
                    this.splashed = true;
                    ctx.ripples.spawn(this.x, this.z, 0.55, 2.2);
                    ctx.ripples.spawn(this.x, this.z, 0.35, 1.2, 0.5);
                    ctx.ripples.spawn(this.x, this.z, 0.2, 0.8, 1.1);
                }
                if (s > 6) this.dropTime = -1;
            }
            this.light = damp(this.light, 1, 1.4, dt);
        }

        const y = wave.h * 0.85 - 0.05 + this.drop + settle;
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
        this.glow.position.set(this.x, y + 0.75, this.z);
        this.glow.material.opacity = 0.9 * bright * glowBoost * distanceFade;
        this.glow.scale.setScalar(3.2 + 0.25 * f);
        this.pool.position.set(this.x, 0.03, this.z);
        this.pool.material.opacity = 0.32 * bright * glowBoost * distanceFade;

        // 偶爾泛起一圈漣漪
        this.nextRipple -= dt;
        if (this.nextRipple <= 0) {
            this.nextRipple = rand(5, 11);
            if (distance < 120) ctx.ripples.spawn(this.x, this.z, 0.12, 1.5);
        }

        // 漂到遠處：退役的水燈消失，其他水燈回到近岸重新出發
        if (this.z < LAKE.far) {
            if (this.retired) {
                this.dispose();
            } else {
                this.respawnNearShore(ctx.cameraPos.z);
            }
        }
    }

    worldAnchor(target) {
        return target.set(this.x, this.group.position.y + 1.6, this.z);
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
            item.mesh.scale.setScalar(1.6 + p * 6 * item.size);
            item.mesh.material.opacity = item.strength * brightness * Math.pow(1 - p, 2) * smoothstep(0, 0.08, p);
        }
    }
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
camera.position.set(0, 7.5, 42);

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
const baseTarget = new THREE.Vector3(0, 3, -10);
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
    textureWidth: IS_MOBILE ? 512 : 1024,
    textureHeight: IS_MOBILE ? 512 : 1024,
    waterNormals: createWaterNormals(256),
    sunDirection: new THREE.Vector3(0, 1, 0),
    sunColor: 0xffffff,
    waterColor: 0x0e1b30,
    distortionScale: 1.6,
    fog: true
});
// 原版 Water shader 會加一個固定的 0.1 灰，夜裡湖面會發白；改成跟水色走。湖面也調得比海面平靜一些。
water.material.fragmentShader = water.material.fragmentShader
    .replace('vec3( 0.1 ) + reflectionSample', 'waterColor * 0.35 + reflectionSample')
    .replace('vec3( 1.5, 1.0, 1.5 )', 'vec3( 0.9, 1.0, 0.9 )');
water.material.uniforms.size.value = 1.6;
water.rotation.x = -Math.PI / 2;
scene.add(water);

const ripples = new Ripples(scene, 48);

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
        z: z ?? rand(LAKE.far + 20, 14)
    });
    if (release) lantern.release();
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
    new THREE.Vector3(LAKE.halfWidth, 25, 40)
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
    if (camera.position.y < 1.2) shiftView(_shift.set(0, 1.2 - camera.position.y, 0));
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
    const minDist = 2.4;
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
