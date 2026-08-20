import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, loadAsync } from 'expo-three';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

export type CompanionVariant = 'male' | 'female';

const ASSET_BASE = (process.env.EXPO_PUBLIC_FATEDROP_COMPANION_ASSET_BASE || 'https://fate-drop.com/assets/companions').replace(/\/$/, '');

const MODELS: Record<CompanionVariant, { file: string; label: string; code: string }> = {
  male: { file: 'fatedrop-male.glb', label: 'KAEL', code: 'K-01' },
  female: { file: 'fatedrop-female.glb', label: 'NYRA', code: 'N-02' },
};

const CLIP_BY_REACTION: Record<CompanionReaction, string> = {
  idle: 'Idle',
  watching: 'Notice',
  echo: 'Echo',
  manifested: 'Manifested',
  vanished: 'Notice',
  fatematch: 'Notice',
  major: 'Celebrate',
};

type LoadedGltf = {
  scene?: THREE.Object3D;
  scenes?: THREE.Object3D[];
  animations?: THREE.AnimationClip[];
};

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
  model.position.y -= center.y + 0.06;
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
  disposed: () => boolean,
) {
  const renderer = new Renderer({ gl, alpha: true, antialias: true });
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    28,
    gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight),
    0.01,
    100,
  );
  camera.position.set(0, 0.02, 4.1);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xd8e8ff, 0x160d25, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(3.5, 5, 4);
  scene.add(key);
  const violet = new THREE.DirectionalLight(0x9d6dff, 2.0);
  violet.position.set(-4, 2.5, 2);
  scene.add(violet);
  const cyan = new THREE.DirectionalLight(0x6ee7ff, 1.25);
  cyan.position.set(3, -1, 1.5);
  scene.add(cyan);

  const modelUrl = `${ASSET_BASE}/${MODELS[variant].file}`;
  const loaded = (await loadAsync(modelUrl)) as LoadedGltf;
  if (disposed()) return () => renderer.dispose();
  const model = loaded.scene ?? loaded.scenes?.[0];
  if (!model) throw new Error(`${MODELS[variant].label} GLB did not contain a scene.`);

  fitModel(model);
  scene.add(model);

  const clips = loaded.animations ?? [];
  const required = ['Idle', 'Echo', 'Notice', 'Manifested', 'Celebrate', 'Walk', 'Run'];
  const clipNames = new Set(clips.map((clip) => clip.name));
  const missing = required.filter((name) => !clipNames.has(name));
  if (missing.length) {
    throw new Error(`${MODELS[variant].label} is missing clips: ${missing.join(', ')}`);
  }

  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) actions.set(clip.name, mixer.clipAction(clip));

  let activeAction: THREE.AnimationAction | null = null;
  let activeClipName = '';

  function syncAction() {
    const clipName = CLIP_BY_REACTION[reaction()];
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
}: {
  variant: CompanionVariant;
  reaction?: CompanionReaction;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const reactionRef = useRef<CompanionReaction>(reaction);
  reactionRef.current = reaction;

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
  return (
    <View style={styles.frame} accessibilityLabel={`${model.label} 3D Companion preview`}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 410, overflow: 'hidden', borderRadius: 26, backgroundColor: '#0B0D16', borderWidth: 1, borderColor: `${FateDropColors.violet}55`, position: 'relative' },
  gl: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  hidden: { opacity: 0 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 1 },
  loaderText: { color: FateDropColors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, zIndex: 4 },
  fallbackMark: { color: FateDropColors.violetLight, fontSize: 34, fontWeight: '900' },
  fallbackTitle: { color: FateDropColors.text, fontSize: 16, fontWeight: '900', marginTop: 10 },
  fallbackText: { color: FateDropColors.secondary, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 7 },
  floorGlow: { position: 'absolute', zIndex: 1, width: '64%', height: 42, borderRadius: 999, bottom: 28, alignSelf: 'center', backgroundColor: `${FateDropColors.violet}24`, transform: [{ scaleX: 1.4 }] },
  identityChip: { position: 'absolute', zIndex: 5, right: 14, top: 14, borderRadius: 999, borderWidth: 1, borderColor: `${FateDropColors.cyan}35`, backgroundColor: '#070910CC', paddingHorizontal: 10, paddingVertical: 7 },
  identityCode: { color: FateDropColors.muted, fontSize: 6, fontWeight: '900', letterSpacing: 1.1 },
  identityName: { color: FateDropColors.cyan, fontSize: 9, fontWeight: '900', marginTop: 1, letterSpacing: 0.7 },
});
