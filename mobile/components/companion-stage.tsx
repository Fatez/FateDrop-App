import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FateDropColors } from '@/constants/theme';
import type { CompanionReaction } from '@/lib/companion-contract';

export type CompanionVariant = 'male' | 'female' | 'droid';

const MODELS: Record<CompanionVariant, { model: number; label: string }> = {
  male: { model: require('../assets/models/fatedrop-male.glb'), label: 'Male companion' },
  female: { model: require('../assets/models/fatedrop-female.glb'), label: 'Female companion' },
  droid: { model: require('../assets/models/fatedrop-droid.glb'), label: 'Signal droid' },
};

type Accessor = { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: 'SCALAR'|'VEC2'|'VEC3'|'VEC4'; normalized?: boolean };
type Glb = { accessors: Accessor[]; bufferViews: { byteOffset?: number; byteStride?: number }[]; meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[] };
type Mesh = { positions: Float32Array; colors: Float32Array; indices: Uint16Array };
const COMPONENT_BYTES: Record<number, number> = { 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as const;

function component(view: DataView, offset: number, type: number) {
  if (type === 5121) return view.getUint8(offset);
  if (type === 5122) return view.getInt16(offset, true);
  if (type === 5123) return view.getUint16(offset, true);
  if (type === 5125) return view.getUint32(offset, true);
  if (type === 5126) return view.getFloat32(offset, true);
  throw new Error(`Unsupported GLB component ${type}.`);
}

function accessor(document: Glb, binary: ArrayBuffer, index: number) {
  const item = document.accessors[index];
  if (item.bufferView == null) throw new Error('Sparse Companion accessors are unsupported.');
  const bufferView = document.bufferViews[item.bufferView];
  const components = TYPE_SIZE[item.type];
  const bytes = COMPONENT_BYTES[item.componentType];
  if (!components || !bytes) throw new Error('Unsupported Companion accessor layout.');
  const stride = bufferView.byteStride || components * bytes;
  const start = (bufferView.byteOffset || 0) + (item.byteOffset || 0);
  const input = new DataView(binary);
  const output = new Float32Array(item.count * components);
  for (let row = 0; row < item.count; row += 1) {
    for (let column = 0; column < components; column += 1) {
      let value = component(input, start + row * stride + column * bytes, item.componentType);
      if (item.normalized) {
        if (item.componentType === 5122) value = Math.max(value / 32767, -1);
        else if (item.componentType === 5123) value /= 65535;
        else if (item.componentType === 5121) value /= 255;
      }
      output[row * components + column] = value;
    }
  }
  return output;
}

function parseGlb(buffer: ArrayBuffer): Mesh {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('Companion is not a GLB v2 model.');
  let offset = 12; let document: Glb | null = null; let binary: ArrayBuffer | null = null;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true); const start = offset + 8;
    if (type === 0x4e4f534a) document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).trim()) as Glb;
    if (type === 0x004e4942) binary = buffer.slice(start, start + length);
    offset = start + length;
  }
  if (!document || !binary) throw new Error('Companion GLB is incomplete.');
  const primitive = document.meshes?.[0]?.primitives?.[0];
  if (!primitive || primitive.indices == null || primitive.attributes.POSITION == null) throw new Error('Companion mesh is incomplete.');
  const rawPositions = accessor(document, binary, primitive.attributes.POSITION);
  const rawColors = primitive.attributes.COLOR_0 == null ? null : accessor(document, binary, primitive.attributes.COLOR_0);
  const rawIndices = accessor(document, binary, primitive.indices);
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for (let i=0;i<rawPositions.length;i+=3){minX=Math.min(minX,rawPositions[i]);maxX=Math.max(maxX,rawPositions[i]);minY=Math.min(minY,rawPositions[i+1]);maxY=Math.max(maxY,rawPositions[i+1]);minZ=Math.min(minZ,rawPositions[i+2]);maxZ=Math.max(maxZ,rawPositions[i+2]);}
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2, cz=(minZ+maxZ)/2, scale=1.72/Math.max(maxX-minX,maxY-minY,maxZ-minZ,0.001);
  const positions=new Float32Array(rawPositions.length);
  for(let i=0;i<rawPositions.length;i+=3){positions[i]=(rawPositions[i]-cx)*scale;positions[i+1]=(rawPositions[i+1]-cy)*scale;positions[i+2]=(rawPositions[i+2]-cz)*scale;}
  const vertexCount=positions.length/3;
  const colors=rawColors?.length===vertexCount*4?rawColors:new Float32Array(vertexCount*4).fill(1);
  const indices=new Uint16Array(rawIndices.length);for(let i=0;i<rawIndices.length;i+=1)indices[i]=rawIndices[i];
  return { positions, colors, indices };
}

function shader(gl: ExpoWebGLRenderingContext, type: number, source: string) {
  const value=gl.createShader(type); if(!value) throw new Error('Could not create Companion shader.');
  gl.shaderSource(value,source);gl.compileShader(value);
  if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(value)||'Companion shader failed.');
  return value;
}

function tint(reaction: CompanionReaction): [number,number,number] {
  if(reaction==='manifested'||reaction==='fatematch')return[0.55,1,0.82];
  if(reaction==='vanished')return[1,0.5,0.58];
  if(reaction==='echo'||reaction==='major')return[0.74,0.48,1];
  return[1,0.94,1];
}

async function draw(gl: ExpoWebGLRenderingContext, variant: CompanionVariant, reaction: CompanionReaction, disposed:()=>boolean) {
  const asset=await Asset.fromModule(MODELS[variant].model).downloadAsync();
  if(!asset.localUri)throw new Error('Companion model could not be cached.');
  const mesh=parseGlb(await new File(asset.localUri).arrayBuffer());if(disposed())return;
  const vs=shader(gl,gl.VERTEX_SHADER,`precision mediump float;attribute vec3 aPosition;attribute vec4 aColor;uniform float uAngle;uniform float uAspect;uniform float uBob;varying vec4 vColor;varying float vLight;void main(){float c=cos(uAngle),s=sin(uAngle);mat3 r=mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);vec3 p=r*aPosition;float a=max(uAspect,0.01);if(a>1.0)p.x/=a;else p.y*=a;p.y+=uBob;gl_Position=vec4(p.x,p.y,p.z*0.45,1.0);vColor=aColor;vLight=0.82+0.18*clamp(p.z+0.5,0.0,1.0);}`);
  const fs=shader(gl,gl.FRAGMENT_SHADER,`precision mediump float;uniform vec3 uTint;varying vec4 vColor;varying float vLight;void main(){vec3 t=mix(vec3(1.0),uTint,0.12);gl_FragColor=vec4(vColor.rgb*t*vLight,vColor.a);}`);
  const program=gl.createProgram();if(!program)throw new Error('Could not create Companion program.');gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Companion program failed.');gl.useProgram(program);
  const bind=(name:string,data:Float32Array,size:number)=>{const location=gl.getAttribLocation(program,name);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);};
  bind('aPosition',mesh.positions,3);bind('aColor',mesh.colors,4);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
  const color=tint(reaction);gl.uniform3f(gl.getUniformLocation(program,'uTint'),color[0],color[1],color[2]);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  const started=Date.now();const frame=()=>{if(disposed())return;const time=(Date.now()-started)/1000;const speed=reaction==='major'?0.45:reaction==='echo'?0.32:0.18;const amp=reaction==='manifested'||reaction==='fatematch'?0.025:0.012;gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(gl.getUniformLocation(program,'uAngle'),Math.sin(time*speed)*0.34);gl.uniform1f(gl.getUniformLocation(program,'uAspect'),gl.drawingBufferWidth/Math.max(1,gl.drawingBufferHeight));gl.uniform1f(gl.getUniformLocation(program,'uBob'),Math.sin(time*1.7)*amp);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);gl.endFrameEXP();requestAnimationFrame(frame);};frame();
}

export function CompanionStage({ variant, reaction='idle' }: { variant: CompanionVariant; reaction?: CompanionReaction }) {
  const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const generation=useRef(0);
  useEffect(()=>{generation.current+=1;setError(null);setReady(false);},[reaction,variant]);
  return <View style={styles.frame} accessibilityLabel={`${MODELS[variant].label} 3D preview`}>
    {!ready&&!error?<View style={styles.loader}><ActivityIndicator color={FateDropColors.violetLight}/><Text style={styles.loaderText}>INITIALISING COMPANION</Text></View>:null}
    {error?<View style={styles.fallback}><Text style={styles.fallbackMark}>FD</Text><Text style={styles.fallbackTitle}>3D preview unavailable</Text><Text style={styles.fallbackText}>The rest of FateDrop stays live. Reopen this screen to retry.</Text></View>:null}
    <GLView key={`${variant}:${reaction}`} style={[styles.gl,error&&styles.hidden]} onContextCreate={async(gl)=>{const mine=generation.current;try{await draw(gl,variant,reaction,()=>generation.current!==mine);if(generation.current===mine)setReady(true);}catch(cause){if(generation.current===mine)setError(cause instanceof Error?cause.message:'Companion renderer failed.');}}}/>
    <View pointerEvents="none" style={styles.floorGlow}/>
  </View>;
}

const styles=StyleSheet.create({
  frame:{height:410,overflow:'hidden',borderRadius:26,backgroundColor:'#0B0D16',borderWidth:1,borderColor:`${FateDropColors.violet}55`,position:'relative'},
  gl:{...StyleSheet.absoluteFillObject,zIndex:2},hidden:{opacity:0},loader:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',gap:10,zIndex:1},loaderText:{color:FateDropColors.secondary,fontSize:9,fontWeight:'900',letterSpacing:1.4},
  fallback:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',paddingHorizontal:34,zIndex:4},fallbackMark:{color:FateDropColors.violetLight,fontSize:34,fontWeight:'900'},fallbackTitle:{color:FateDropColors.text,fontSize:16,fontWeight:'900',marginTop:10},fallbackText:{color:FateDropColors.secondary,textAlign:'center',fontSize:11,lineHeight:17,marginTop:7},floorGlow:{position:'absolute',zIndex:1,width:'64%',height:42,borderRadius:999,bottom:28,alignSelf:'center',backgroundColor:`${FateDropColors.violet}24`,transform:[{scaleX:1.4}]},
});
