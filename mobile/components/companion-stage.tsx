import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

export type CompanionVariant = 'male' | 'female';
export const REQUIRED_COMPANION_CLIPS = ['Idle', 'Echo', 'Notice', 'Manifested', 'Celebrate', 'Walk', 'Run'] as const;
export type CompanionClipName = (typeof REQUIRED_COMPANION_CLIPS)[number];

const MODELS: Record<CompanionVariant, { assetModule: number; label: string; code: string }> = {
  male: {
    assetModule: require('../assets/companions/fatedrop-male-mobile.glb'),
    label: 'KAEL',
    code: 'K-01',
  },
  female: {
    assetModule: require('../assets/companions/fatedrop-female-mobile.glb'),
    label: 'NYRA',
    code: 'N-02',
  },
};

const CLIP_BY_REACTION: Record<CompanionReaction, CompanionClipName> = {
  idle: 'Idle',
  watching: 'Notice',
  echo: 'Echo',
  manifested: 'Manifested',
  vanished: 'Notice',
  fatematch: 'Notice',
  major: 'Celebrate',
};

type CanvasShim = HTMLCanvasElement & {
  width: number;
  height: number;
  clientHeight: number;
};

/**
 * Expo GL gives us the native WebGL context directly. Three only needs this
 * minimal canvas surface; keeping the bridge here avoids reintroducing
 * expo-three and preserves the known-good Expo Go boot path.
 */
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

/**
 * Three r166's GLTFLoader checks navigator.userAgent when constructing its
 * parser. React Native/Hermes can expose navigator without a userAgent string,
 * which makes GLTFLoader call .match() on undefined before it ever reads our
 * valid GLB. Only fill the missing value; never overwrite a real user agent.
 */
function ensureThreeNativeNavigatorCompatibility() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent === 'string') return;

  try {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'ReactNative',
    });
  } catch {
    (navigator as unknown as { userAgent?: string }).userAgent = 'ReactNative';
  }
}

async function loadCompanionGltf(assetModule: number): Promise<GLTF> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Companion asset did not resolve to a local file.');

  const buffer = await new File(asset.localUri).arrayBuffer();
  if (buffer.byteLength < 20) throw new Error('Companion GLB was empty or invalid.');

  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('Companion asset is not a valid GLB v2 file.');
  }

  ensureThreeNativeNavigatorCompatibility();
  const loader = new GLTFLoader();
  return new Promise<GLTF>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      resolve,
      (cause) => reject(cause instanceof Error ? cause : new Error('Companion GLB could not be parsed.')),
    );
  });
}

function fitModel(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) throw new Error('Companion GLB has no visible geometry.');

  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, 0.0001);
  model.scale.multiplyScalar(1.72 / height);
  model.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= center.y + 0.05;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
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
  const renderer = createRenderer(gl);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    27,
    gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight),
    0.01,
    100,
  );
  camera.position.set(0, 0.03, 4.05);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x140b22, 2.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(3.4, 5, 4.2);
  scene.add(key);
  const violet = new THREE.DirectionalLight(0x9d6dff, 1.7);
  violet.position.set(-4, 2.7, 2.2);
  scene.add(violet);
  const cyan = new THREE.DirectionalLight(0x6ee7ff, 1.05);
  cyan.position.set(3, -0.8, 1.6);
  scene.add(cyan);

  const loaded = await loadCompanionGltf(MODELS[variant].assetModule);
  if (disposed()) {
    renderer.dispose();
    return () => undefined;
  }

  const model = loaded.scene ?? loaded.scenes?.[0];
  if (!model) throw new Error(`${MODELS[variant].label} GLB did not contain a scene.`);

  fitModel(model);
  scene.add(model);

  const clips = loaded.animations ?? [];
  const clipNames = new Set(clips.map((clip) => clip.name));
  const missing = REQUIRED_COMPANION_CLIPS.filter((name) => !clipNames.has(name));
  if (missing.length) {
    throw new Error(`${MODELS[variant].label} is missing clips: ${missing.join(', ')}`);
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) actions.set(clip.name, mixer.clipAction(clip));

  let activeAction: THREE.AnimationAction | null = null;
  let activeClipName = '';

  function syncAction() {
    const clipName = previewClip() ?? CLIP_BY_REACTION[reaction()];
    if (clipName === activeClipName) return;

    const nextAction = actions.get(clipName) ?? actions.get('Idle');
    if (!nextAction) return;

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(1);
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.play();

    if (activeAction && activeAction !== nextAction) {
      activeAction.crossFadeTo(nextAction, 0.22, false);
    }
    activeAction = nextAction;
    activeClipName = clipName;
  }

  syncAction();
  const clock = new THREE.Clock();
  let frameId = 0;
  const frame = () => {
    if (disposed()) return;
    frameId = requestAnimationFrame(frame);
    syncAction();
    mixer.update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
    gl.endFrameEXP();
  };
  frame();

  return () => {
    cancelAnimationFrame(frameId);
    mixer.stopAllAction();
    scene.remove(model);
    disposeObject(model);
    renderer.dispose();
  };
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

  const model = MODELS[variant];
  const activeClip = previewClip ?? CLIP_BY_REACTION[reaction];

  return (
    <View style={styles.frame} accessibilityLabel={`${model.label} 3D Companion preview`}>
      <View pointerEvents="none" style={styles.backGlow} />
      {!ready && !error ? (
        <View style={styles.loader}>
          <ActivityIndicator color={FateDropColors.violetLight} />
          <Text style={styles.loaderText}>INITIALISING {model.label}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackMark}>FD</Text>
          <Text style={styles.fallbackTitle}>{model.label} unavailable</Text>
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
            setError(cause instanceof Error ? cause.message : `${model.label} renderer failed.`);
          }
        }}
      />
      <View pointerEvents="none" style={styles.floorGlow} />
      <View pointerEvents="none" style={styles.identityChip}>
        <Text style={styles.identityCode}>{model.code}</Text>
        <Text style={styles.identityName}>{model.label}</Text>
      </View>
      <View pointerEvents="none" style={styles.clipChip}>
        <View style={[styles.clipDot, !ready && styles.clipDotPending]} />
        <Text style={styles.clipLabel}>{ready ? activeClip.toUpperCase() : 'LOADING'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 430, overflow: 'hidden', borderRadius: 28, backgroundColor: '#090B13', borderWidth: 1, borderColor: `${FateDropColors.violet}58`, position: 'relative' },
  gl: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  hidden: { opacity: 0 },
  backGlow: { position: 'absolute', zIndex: 0, width: 300, height: 300, borderRadius: 150, top: 30, alignSelf: 'center', backgroundColor: `${FateDropColors.violet}10` },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 1 },
  loaderText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, zIndex: 4 },
  fallbackMark: { color: FateDropColors.violetLight, fontSize: 34, fontWeight: '900' },
  fallbackTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 10 },
  fallbackText: { color: FateDropColors.secondary, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 7 },
  floorGlow: { position: 'absolute', zIndex: 1, width: '64%', height: 44, borderRadius: 999, bottom: 27, alignSelf: 'center', backgroundColor: `${FateDropColors.violet}2A`, transform: [{ scaleX: 1.5 }] },
  identityChip: { position: 'absolute', zIndex: 5, right: 14, top: 14, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.cyan}35`, backgroundColor: '#070910DD', paddingHorizontal: 10, paddingVertical: 7 },
  identityCode: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: 1.1 },
  identityName: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', marginTop: 1, letterSpacing: 0.7 },
  clipChip: { position: 'absolute', zIndex: 5, left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: FateDropColors.border, backgroundColor: '#070910DD', paddingHorizontal: 10, paddingVertical: 7 },
  clipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FateDropColors.mint },
  clipDotPending: { backgroundColor: FateDropColors.muted },
  clipLabel: { color: FateDropColors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
});
