import { Asset } from 'expo-asset';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { FateDropColors } from '@/constants/theme';
import {
  COMPANION_CLIP_BY_REACTION,
  companionDefinition,
  type CompanionId,
  type CompanionReaction,
} from '@/lib/companion-contract';

export type CompanionVariant = CompanionId;
export const REQUIRED_COMPANION_CLIPS = ['Idle', 'Whisper', 'Echo', 'Manifested', 'Vanished', 'FateMatch'] as const;
export type CompanionClipName = (typeof REQUIRED_COMPANION_CLIPS)[number];

const DEFAULT_FATEDROP_WEB_URL = 'https://fatedrop-web.fatedrop-web.workers.dev';
const FATEDROP_WEB_URL = String(process.env.EXPO_PUBLIC_FATEDROP_WEB_URL || DEFAULT_FATEDROP_WEB_URL).replace(/\/$/, '');
const REMOTE_ASSET_BASE = String(process.env.EXPO_PUBLIC_COMPANION_ASSET_BASE_URL || `${FATEDROP_WEB_URL}/assets/companions`).replace(/\/$/, '');

const MODEL_PATHS: Record<CompanionVariant, { model: string; texture: string }> = {
  oru: { model: 'oru/oru.glb', texture: 'oru/oru-texture.jpg' },
  nyxen: { model: 'nyxen/nyxen.glb', texture: 'nyxen/nyxen-texture.jpg' },
  solix: { model: 'solix/solix.glb', texture: 'solix/solix-texture.jpg' },
  aeris: { model: 'aeris/aeris.glb', texture: 'aeris/aeris-texture.jpg' },
};

const ONE_SHOT_CLIPS = new Set<CompanionClipName>(['Manifested', 'Vanished', 'FateMatch']);

type CanvasShim = HTMLCanvasElement & {
  width: number;
  height: number;
  clientHeight: number;
};

function createRenderer(gl: ExpoWebGLRenderingContext) {
  const canvas = {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as CanvasShim;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl as unknown as WebGLRenderingContext,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** Three r166 can see a React Native navigator without userAgent. */
function ensureThreeNativeNavigatorCompatibility() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'string') return;
  try {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'ReactNative' });
  } catch {
    (navigator as unknown as { userAgent?: string }).userAgent = 'ReactNative';
  }
}

function remoteAssetUrl(path: string) {
  return `${REMOTE_ASSET_BASE}/${path}`;
}

async function loadCompanionGltf(url: string): Promise<GLTF> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Character model HTTP ${response.status}.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 20) throw new Error('Character GLB was empty or invalid.');

  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('Character asset is not a valid GLB v2 file.');
  }

  ensureThreeNativeNavigatorCompatibility();
  const loader = new GLTFLoader();
  return new Promise<GLTF>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      resolve,
      (cause) => reject(cause instanceof Error ? cause : new Error('Character GLB could not be parsed.')),
    );
  });
}

async function loadCompanionTexture(url: string) {
  const asset = Asset.fromURI(url);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('Character texture did not resolve to a local asset.');

  let width = asset.width ?? 0;
  let height = asset.height ?? 0;
  if (!width || !height) {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      RNImage.getSize(
        uri,
        (resolvedWidth, resolvedHeight) => resolve({ width: resolvedWidth, height: resolvedHeight }),
        reject,
      );
    });
    width = dimensions.width;
    height = dimensions.height;
  }
  if (!width || !height) throw new Error('Character texture dimensions could not be resolved.');

  // Expo GL understands Expo Asset objects directly. This keeps image decoding
  // off the JS thread and lets the four-character pack stay light on mobile.
  const texture = new THREE.Texture() as THREE.Texture & { isDataTexture: boolean };
  texture.isDataTexture = true;
  texture.image = { data: asset, width, height } as unknown as TexImageSource;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function applyProductionTexture(model: THREE.Object3D, texture: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.46,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  let meshCount = 0;
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshCount += 1;
    const previous = Array.isArray(child.material) ? child.material : [child.material];
    for (const item of previous) item?.dispose();
    child.material = material;
  });

  if (!meshCount) {
    material.dispose();
    texture.dispose();
    throw new Error('Character GLB has no textured mesh.');
  }
}

function fitModel(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) throw new Error('Character GLB has no visible geometry.');

  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, 0.0001);
  model.scale.multiplyScalar(1.72 / height);
  model.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= center.y + 0.06;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function disposeObject(root: THREE.Object3D) {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material || disposedMaterials.has(material)) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
          value.dispose();
          disposedTextures.add(value);
        }
      }
      material.dispose();
      disposedMaterials.add(material);
    }
  });
}

async function createScene(
  gl: ExpoWebGLRenderingContext,
  variant: CompanionVariant,
  reaction: () => CompanionReaction,
  previewClip: () => CompanionClipName | null,
  disposed: () => boolean,
) {
  const definition = companionDefinition(variant);
  const renderer = createRenderer(gl);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight), 0.01, 100);
  camera.position.set(0, 0.03, 4.05);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xf2eee6, 0x16111d, 1.65));
  const key = new THREE.DirectionalLight(0xfff8ed, 2.05);
  key.position.set(3.2, 4.8, 4.2);
  scene.add(key);
  const violet = new THREE.DirectionalLight(0xb799c7, 0.9);
  violet.position.set(-4, 2.4, 2.2);
  scene.add(violet);
  const soft = new THREE.DirectionalLight(0x9bc9c1, 0.38);
  soft.position.set(3, -0.8, 1.6);
  scene.add(soft);

  let texture: THREE.Texture | null = null;
  let model: THREE.Object3D | null = null;

  try {
    const paths = MODEL_PATHS[variant];
    const [loaded, loadedTexture] = await Promise.all([
      loadCompanionGltf(remoteAssetUrl(paths.model)),
      loadCompanionTexture(remoteAssetUrl(paths.texture)),
    ]);
    texture = loadedTexture;

    if (disposed()) {
      texture.dispose();
      renderer.dispose();
      return () => undefined;
    }

    model = loaded.scene ?? loaded.scenes?.[0] ?? null;
    if (!model) throw new Error(`${definition.name} GLB did not contain a scene.`);

    applyProductionTexture(model, texture);
    fitModel(model);
    scene.add(model);

    const clips = loaded.animations ?? [];
    const clipNames = new Set(clips.map((clip) => clip.name));
    const missing = REQUIRED_COMPANION_CLIPS.filter((name) => !clipNames.has(name));
    if (missing.length) throw new Error(`${definition.name} is missing clips: ${missing.join(', ')}`);

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<CompanionClipName, THREE.AnimationAction>();
    for (const clip of clips) {
      if ((REQUIRED_COMPANION_CLIPS as readonly string[]).includes(clip.name)) {
        actions.set(clip.name as CompanionClipName, mixer.clipAction(clip));
      }
    }

    let activeAction: THREE.AnimationAction | null = null;
    let activeDesiredClip: CompanionClipName | '' = '';
    let oneShotSettled = false;

    function playDesired(clipName: CompanionClipName) {
      const nextAction = actions.get(clipName) ?? actions.get('Idle');
      if (!nextAction) return;
      nextAction.enabled = true;
      nextAction.reset();
      nextAction.setEffectiveWeight(1);
      nextAction.setEffectiveTimeScale(1);
      nextAction.clampWhenFinished = ONE_SHOT_CLIPS.has(clipName);
      nextAction.setLoop(ONE_SHOT_CLIPS.has(clipName) ? THREE.LoopOnce : THREE.LoopRepeat, ONE_SHOT_CLIPS.has(clipName) ? 1 : Infinity);
      nextAction.play();
      if (activeAction && activeAction !== nextAction) activeAction.crossFadeTo(nextAction, 0.22, false);
      activeAction = nextAction;
      activeDesiredClip = clipName;
      oneShotSettled = false;
    }

    function syncAction() {
      const desired = previewClip() ?? COMPANION_CLIP_BY_REACTION[reaction()];
      if (desired === activeDesiredClip) return;
      playDesired(desired);
    }

    function settleOneShotToIdle() {
      if (!activeAction || !activeDesiredClip || !ONE_SHOT_CLIPS.has(activeDesiredClip) || oneShotSettled) return;
      const duration = activeAction.getClip().duration;
      if (activeAction.time < Math.max(0, duration - 0.06)) return;
      const idle = actions.get('Idle');
      if (!idle) return;
      idle.enabled = true;
      idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      activeAction.crossFadeTo(idle, 0.24, false);
      activeAction = idle;
      oneShotSettled = true;
    }

    syncAction();
    const clock = new THREE.Clock();
    let frameId = 0;
    const frame = () => {
      if (disposed()) return;
      frameId = requestAnimationFrame(frame);
      syncAction();
      mixer.update(Math.min(clock.getDelta(), 0.05));
      settleOneShotToIdle();
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    frame();

    return () => {
      cancelAnimationFrame(frameId);
      mixer.stopAllAction();
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      renderer.dispose();
    };
  } catch (cause) {
    if (model) disposeObject(model);
    else texture?.dispose();
    renderer.dispose();
    throw cause;
  }
}

export function CompanionStage({
  variant,
  reaction = 'idle',
  previewClip = null,
}: {
  variant: CompanionVariant;
  reaction?: CompanionReaction;
  previewClip?: CompanionClipName | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const reactionRef = useRef<CompanionReaction>(reaction);
  const previewClipRef = useRef<CompanionClipName | null>(previewClip);
  reactionRef.current = reaction;
  previewClipRef.current = previewClip;

  useEffect(() => {
    generation.current += 1;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setError(null);
    setReady(false);
    return () => {
      generation.current += 1;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [variant]);

  const model = companionDefinition(variant);
  const activeClip = previewClip ?? COMPANION_CLIP_BY_REACTION[reaction];

  return (
    <View style={styles.frame} accessibilityLabel={`${model.name} 3D FateDrop companion preview`}>
      <View pointerEvents="none" style={styles.paperGlow} />
      <View pointerEvents="none" style={styles.signalMoon} />
      <View pointerEvents="none" style={styles.signalHill} />
      {!ready && !error ? (
        <View style={styles.loader}>
          <ActivityIndicator color={FateDropColors.violetLight} />
          <Text style={styles.loaderTitle}>{model.name === 'Oru' ? 'ORU IS TRACING THE SIGNAL' : `CALLING ${model.name.toUpperCase()}`}</Text>
          <Text style={styles.loaderText}>Preparing the Oru & Friends stage…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.fallback}>
          <View style={styles.fallbackMark}><Text style={styles.fallbackMarkText}>{model.name.slice(0, 1)}</Text></View>
          <Text style={styles.fallbackTitle}>{model.name} is off exploring</Text>
          <Text style={styles.fallbackText}>{error}</Text>
        </View>
      ) : null}
      <GLView
        key={variant}
        style={[styles.gl, error && styles.hidden]}
        onContextCreate={async (gl) => {
          const mine = generation.current;
          try {
            const cleanup = await createScene(
              gl,
              variant,
              () => reactionRef.current,
              () => previewClipRef.current,
              () => generation.current !== mine,
            );
            if (generation.current !== mine) {
              cleanup?.();
              return;
            }
            cleanupRef.current = cleanup;
            setReady(true);
          } catch (cause) {
            if (generation.current !== mine) return;
            setError(cause instanceof Error ? cause.message : `${model.name} renderer failed.`);
          }
        }}
      />
      <View pointerEvents="none" style={styles.floorGlow} />
      <View pointerEvents="none" style={styles.identityChip}>
        <Text style={styles.identityCode}>{model.code}</Text>
        <View>
          <Text style={styles.identityName}>{model.name}</Text>
          <Text style={styles.identityRole}>{model.role}</Text>
        </View>
      </View>
      <View pointerEvents="none" style={styles.clipChip}>
        <View style={[styles.clipDot, !ready && styles.clipDotPending]} />
        <Text style={styles.clipLabel}>{ready ? activeClip.toUpperCase() : 'LOADING'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 430,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#0B0D12',
    borderWidth: 1,
    borderColor: 'rgba(202, 181, 201, 0.20)',
    position: 'relative',
  },
  gl: { ...StyleSheet.absoluteFillObject, zIndex: 3 },
  hidden: { opacity: 0 },
  paperGlow: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 165,
    left: -95,
    top: -110,
    backgroundColor: 'rgba(155, 121, 165, 0.11)',
  },
  signalMoon: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -22,
    top: 54,
    borderWidth: 1,
    borderColor: 'rgba(215, 201, 193, 0.14)',
    backgroundColor: 'rgba(228, 216, 202, 0.025)',
  },
  signalHill: {
    position: 'absolute',
    width: 470,
    height: 190,
    borderRadius: 240,
    left: -60,
    bottom: -145,
    borderWidth: 1,
    borderColor: 'rgba(125, 158, 150, 0.12)',
    backgroundColor: 'rgba(89, 119, 109, 0.035)',
    transform: [{ rotate: '-4deg' }],
  },
  floorGlow: {
    position: 'absolute',
    zIndex: 2,
    width: 190,
    height: 28,
    borderRadius: 95,
    left: '50%',
    marginLeft: -95,
    bottom: 53,
    backgroundColor: 'rgba(169, 135, 179, 0.08)',
    transform: [{ scaleY: 0.5 }],
  },
  loader: { ...StyleSheet.absoluteFillObject, zIndex: 4, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loaderTitle: { color: FateDropColors.text, fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginTop: 4 },
  loaderText: { color: FateDropColors.muted, fontSize: 9 },
  fallback: { ...StyleSheet.absoluteFillObject, zIndex: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  fallbackMark: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(166, 130, 176, 0.12)', borderWidth: 1, borderColor: 'rgba(196, 166, 201, 0.22)' },
  fallbackMarkText: { color: '#DED0D6', fontSize: 28, fontWeight: '700' },
  fallbackTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 12 },
  fallbackText: { color: FateDropColors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 5 },
  identityChip: { position: 'absolute', zIndex: 6, left: 13, bottom: 13, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(9, 10, 15, 0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  identityCode: { color: FateDropColors.violetLight, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  identityName: { color: FateDropColors.text, fontSize: 11, fontWeight: '900' },
  identityRole: { color: FateDropColors.muted, fontSize: 7, marginTop: 1 },
  clipChip: { position: 'absolute', zIndex: 6, right: 13, bottom: 13, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(9, 10, 15, 0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  clipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint },
  clipDotPending: { backgroundColor: FateDropColors.muted },
  clipLabel: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
});
