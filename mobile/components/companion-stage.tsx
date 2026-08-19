import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

export type CompanionVariant = 'male' | 'female' | 'droid';

type ModelAsset = {
  model: number;
  texture: number;
  label: string;
};

const MODEL_ASSETS: Record<CompanionVariant, ModelAsset> = {
  male: {
    model: require('../assets/models/fatedrop-male.glb'),
    texture: require('../assets/models/fatedrop-male-basecolor.png'),
    label: 'Male companion',
  },
  female: {
    model: require('../assets/models/fatedrop-female.glb'),
    texture: require('../assets/models/fatedrop-female-basecolor.png'),
    label: 'Female companion',
  },
  droid: {
    model: require('../assets/models/fatedrop-droid.glb'),
    texture: require('../assets/models/fatedrop-droid-basecolor.png'),
    label: 'Signal droid',
  },
};

type ParsedMesh = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4';
};

type BufferView = {
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
};

type GlbDocument = {
  accessors: Accessor[];
  bufferViews: BufferView[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
};

const COMPONENT_BYTES: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as const;

function readComponent(view: DataView, offset: number, type: number) {
  if (type === 5121) return view.getUint8(offset);
  if (type === 5123) return view.getUint16(offset, true);
  if (type === 5125) return view.getUint32(offset, true);
  if (type === 5126) return view.getFloat32(offset, true);
  throw new Error(`Unsupported GLB component type ${type}.`);
}

function readAccessor(document: GlbDocument, binary: ArrayBuffer, accessorIndex: number) {
  const accessor = document.accessors[accessorIndex];
  if (accessor.bufferView == null) throw new Error('Sparse GLB accessors are not supported by the mobile renderer.');
  const bufferView = document.bufferViews[accessor.bufferView];
  const components = TYPE_COMPONENTS[accessor.type];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  if (!components || !componentBytes) throw new Error('Unsupported GLB accessor layout.');
  const stride = bufferView.byteStride || components * componentBytes;
  const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const input = new DataView(binary);
  const output = new Float32Array(accessor.count * components);
  for (let row = 0; row < accessor.count; row += 1) {
    for (let column = 0; column < components; column += 1) {
      output[row * components + column] = readComponent(input, start + row * stride + column * componentBytes, accessor.componentType);
    }
  }
  return output;
}

function parseGlb(buffer: ArrayBuffer): ParsedMesh {
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) throw new Error('Companion model is not a GLB v2 file.');

  let offset = 12;
  let document: GlbDocument | null = null;
  let binary: ArrayBuffer | null = null;
  while (offset + 8 <= buffer.byteLength) {
    const length = header.getUint32(offset, true);
    const type = header.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (type === 0x4e4f534a) {
      const text = new TextDecoder().decode(new Uint8Array(buffer, chunkStart, length)).replace(/\u0000+$/g, '').trim();
      document = JSON.parse(text) as GlbDocument;
    } else if (type === 0x004e4942) {
      binary = buffer.slice(chunkStart, chunkStart + length);
    }
    offset = chunkStart + length;
  }
  if (!document || !binary) throw new Error('Companion GLB is missing its JSON or binary chunk.');

  const primitive = document.meshes?.[0]?.primitives?.[0];
  if (!primitive || primitive.indices == null || primitive.attributes.POSITION == null) throw new Error('Companion GLB mesh is incomplete.');
  const positions = readAccessor(document, binary, primitive.attributes.POSITION);
  const rawNormals = primitive.attributes.NORMAL == null ? null : readAccessor(document, binary, primitive.attributes.NORMAL);
  const rawUvs = primitive.attributes.TEXCOORD_0 == null ? null : readAccessor(document, binary, primitive.attributes.TEXCOORD_0);
  const rawIndices = readAccessor(document, binary, primitive.indices);

  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]); maxX = Math.max(maxX, positions[index]);
    minY = Math.min(minY, positions[index + 1]); maxY = Math.max(maxY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]); maxZ = Math.max(maxZ, positions[index + 2]);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const scale = 1.72 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);
  const normalizedPositions = new Float32Array(positions.length);
  for (let index = 0; index < positions.length; index += 3) {
    normalizedPositions[index] = (positions[index] - centerX) * scale;
    normalizedPositions[index + 1] = (positions[index + 1] - centerY) * scale;
    normalizedPositions[index + 2] = (positions[index + 2] - centerZ) * scale;
  }

  const vertexCount = normalizedPositions.length / 3;
  const normals = rawNormals?.length === normalizedPositions.length ? rawNormals : new Float32Array(vertexCount * 3).fill(0);
  const uvs = rawUvs?.length === vertexCount * 2 ? rawUvs : new Float32Array(vertexCount * 2).fill(0.5);
  const indices = new Uint16Array(rawIndices.length);
  for (let index = 0; index < rawIndices.length; index += 1) indices[index] = rawIndices[index];
  return { positions: normalizedPositions, normals, uvs, indices };
}

function shader(gl: ExpoWebGLRenderingContext, type: number, source: string) {
  const value = gl.createShader(type);
  if (!value) throw new Error('Could not create a Companion shader.');
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || 'Companion shader compilation failed.');
  return value;
}

function reactionTint(reaction: CompanionReaction): [number, number, number] {
  if (reaction === 'manifested' || reaction === 'fatematch') return [0.45, 1, 0.78];
  if (reaction === 'vanished') return [1, 0.45, 0.55];
  if (reaction === 'echo' || reaction === 'major') return [0.72, 0.42, 1];
  return [0.9, 0.82, 1];
}

async function renderCompanion(
  gl: ExpoWebGLRenderingContext,
  variant: CompanionVariant,
  reaction: CompanionReaction,
  disposed: () => boolean,
) {
  const source = MODEL_ASSETS[variant];
  const [modelAsset, textureAsset] = await Promise.all([
    Asset.fromModule(source.model).downloadAsync(),
    Asset.fromModule(source.texture).downloadAsync(),
  ]);
  if (!modelAsset.localUri) throw new Error('The Companion model could not be cached on this device.');
  const bytes = await new File(modelAsset.localUri).arrayBuffer();
  const mesh = parseGlb(bytes);
  if (disposed()) return;

  const vertexShader = shader(gl, gl.VERTEX_SHADER, `
    precision mediump float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform float uAngle;
    uniform float uAspect;
    uniform float uBob;
    varying vec2 vUv;
    varying float vLight;
    void main() {
      float c = cos(uAngle); float s = sin(uAngle);
      mat3 rot = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
      vec3 p = rot * aPosition;
      vec3 n = normalize(rot * aNormal);
      float safeAspect = max(uAspect, 0.01);
      if (safeAspect > 1.0) p.x /= safeAspect; else p.y *= safeAspect;
      p.y += uBob;
      gl_Position = vec4(p.x, p.y, p.z * 0.45, 1.0);
      vUv = vec2(aUv.x, 1.0 - aUv.y);
      vLight = 0.62 + 0.38 * max(dot(n, normalize(vec3(0.25, 0.75, 0.55))), 0.0);
    }
  `);
  const fragmentShader = shader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec3 uTint;
    varying vec2 vUv;
    varying float vLight;
    void main() {
      vec4 texel = texture2D(uTexture, vUv);
      if (texel.a < 0.05) discard;
      vec3 tint = mix(vec3(1.0), uTint, 0.10);
      gl_FragColor = vec4(texel.rgb * tint * vLight, texel.a);
    }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create the Companion rendering program.');
  gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Companion shader linking failed.');
  gl.useProgram(program);

  const bindFloatBuffer = (name: string, values: Float32Array, size: number) => {
    const location = gl.getAttribLocation(program, name);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  bindFloatBuffer('aPosition', mesh.positions, 3);
  bindFloatBuffer('aNormal', mesh.normals, 3);
  bindFloatBuffer('aUv', mesh.uvs, 2);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (!textureAsset.localUri) throw new Error('The Companion texture could not be cached on this device.');
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, { localUri: textureAsset.localUri } as never);
  gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 0);

  const tint = reactionTint(reaction);
  gl.uniform3f(gl.getUniformLocation(program, 'uTint'), tint[0], tint[1], tint[2]);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  const started = Date.now();
  const frame = () => {
    if (disposed()) return;
    const time = (Date.now() - started) / 1000;
    const speed = reaction === 'major' ? 0.45 : reaction === 'echo' ? 0.32 : 0.18;
    const amplitude = reaction === 'manifested' || reaction === 'fatematch' ? 0.025 : 0.012;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(gl.getUniformLocation(program, 'uAngle'), Math.sin(time * speed) * 0.34);
    gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight));
    gl.uniform1f(gl.getUniformLocation(program, 'uBob'), Math.sin(time * 1.7) * amplitude);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.endFrameEXP();
    requestAnimationFrame(frame);
  };
  frame();
}

export function CompanionStage({ variant, reaction = 'idle' }: { variant: CompanionVariant; reaction?: CompanionReaction }) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setError(null);
    setReady(false);
  }, [reaction, variant]);

  const generationAtRender = generation.current;
  return (
    <View style={styles.frame} accessibilityLabel={`${MODEL_ASSETS[variant].label} 3D preview`}>
      {!ready && !error ? <View style={styles.loader}><ActivityIndicator color={FateDropColors.violetLight} /><Text style={styles.loaderText}>INITIALISING COMPANION</Text></View> : null}
      {error ? <View style={styles.fallback}><Text style={styles.fallbackMark}>FD</Text><Text style={styles.fallbackTitle}>3D preview unavailable</Text><Text style={styles.fallbackText}>The rest of FateDrop stays live. Reopen the Companion screen to retry the renderer.</Text></View> : null}
      <GLView
        key={`${variant}:${reaction}:${generationAtRender}`}
        style={[styles.gl, error && styles.hidden]}
        onContextCreate={async (gl) => {
          const myGeneration = generation.current;
          try {
            await renderCompanion(gl, variant, reaction, () => generation.current !== myGeneration);
            if (generation.current === myGeneration) setReady(true);
          } catch (cause) {
            if (generation.current === myGeneration) setError(cause instanceof Error ? cause.message : 'Companion renderer failed.');
          }
        }}
      />
      <View pointerEvents="none" style={styles.floorGlow} />
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
});
