import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Sprout, 
  BookOpen, 
  Moon, 
  Sun, 
  MapPin, 
  Play, 
  Book, 
  Volume2,
  Pause,
  ChevronLeft,
  Search,
  GraduationCap,
  Settings,
  Share2,
  HelpCircle,
  User,
  Info,
  Type as TypeIcon,
  Check,
  Plus,
  RotateCcw,
  List,
  Sunrise,
  Sunset,
  MoonStar,
  Bed,
  CloudSun,
  Star,
  Download
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, Environment, Float, PerspectiveCamera, PointerLockControls, Clouds, Cloud } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// --- Types ---
type Section = 'home' | 'farm' | 'knowledge' | 'quran-reader' | 'settings' | 'misbaha' | 'adhkar';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  page: number;
}

type BookmarkType = 'fast' | 'reflection' | 'memorization' | 'general';

interface Bookmark {
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  type: BookmarkType;
}

interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface Verse {
  text: string;
  surah: string;
  number: number;
}

interface Reciter {
  id: string;
  name: string;
  server: string;
}

interface Tafsir {
  id: string;
  name: string;
}

// --- Background Decorations ---
function BackgroundDecorations({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <AnimatePresence mode="wait">
        {!isDarkMode ? (
          <motion.div
            key="day-decor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {/* Sun */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
              className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-200/20 rounded-full blur-3xl"
            />
            <div className="absolute top-10 right-10 text-yellow-400/30">
              <Sun size={120} strokeWidth={1} />
            </div>
            
            {/* Clouds */}
            <motion.div 
              animate={{ x: [0, 50, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-40 left-[10%] text-white/40"
            >
              <CloudSun size={80} strokeWidth={1} />
            </motion.div>
            <motion.div 
              animate={{ x: [0, -30, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-80 right-[15%] text-white/30"
            >
              <Cloud size={60} strokeWidth={1} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="night-decor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {/* Moon */}
            <div className="absolute top-10 right-10 text-slate-400/20">
              <MoonStar size={100} strokeWidth={1} />
            </div>
            
            {/* Stars */}
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 2 + Math.random() * 3, repeat: Infinity }}
                className="absolute text-white/20"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                }}
              >
                <Star size={10 + Math.random() * 10} fill="currentColor" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- 3D Components ---

const WIND_SHADER = {
  vertex: `
    varying vec2 vUv;
    varying float vWind;
    uniform float uTime;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Calculate wind based on world position and time
      float wind = sin(uTime * 0.8 + modelMatrix[3][0] * 0.1 + modelMatrix[3][2] * 0.1) * 0.15;
      vWind = wind;
      
      // Apply sway based on height
      float heightFactor = pos.y * 0.25;
      pos.x += wind * heightFactor;
      pos.z += wind * heightFactor;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragment: `
    varying vec2 vUv;
    varying float vWind;
    uniform vec3 uColor;
    
    void main() {
      // Slight color variation based on wind
      vec3 color = uColor + vWind * 0.1;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

function TreeInstanced({ trees }: { trees: { id: number; pos: [number, number, number]; scale: number }[] }) {
  const trunkRef = React.useRef<THREE.InstancedMesh>(null);
  const leafRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  
  const trunkGeometry = React.useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Main trunk
    const mainTrunk = new THREE.CylinderGeometry(0.15, 0.25, 4, 8);
    mainTrunk.translate(0, 2, 0);
    geometries.push(mainTrunk);
    
    // Branches
    for (let i = 0; i < 3; i++) {
      const branch = new THREE.CylinderGeometry(0.05, 0.1, 1.5, 6);
      branch.rotateZ(Math.PI / 4 + (i * 0.2));
      branch.rotateY((i * Math.PI * 2) / 3);
      branch.translate(0, 2.5 + i * 0.3, 0);
      geometries.push(branch);
    }
    
    return mergeGeometries(geometries);
  }, []);

  const leafGeometry = React.useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Clusters of leaves
    const positions = [
      [0, 4, 0], [0.7, 3.5, 0.7], [-0.7, 3.5, -0.7], [0.7, 3.5, -0.7], [-0.7, 3.5, 0.7],
      [1, 3, 0], [-1, 3, 0], [0, 3, 1], [0, 3, -1]
    ];
    
    positions.forEach(([x, y, z]) => {
      const geo = new THREE.IcosahedronGeometry(0.8, 0);
      geo.translate(x, y, z);
      geometries.push(geo);
    });
    
    return mergeGeometries(geometries);
  }, []);

  const leafMaterial = React.useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WIND_SHADER.vertex,
    fragmentShader: WIND_SHADER.fragment,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#1b5e20") }
    },
  }), []);

  useFrame((state) => {
    leafMaterial.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  React.useEffect(() => {
    if (!trunkRef.current || !leafRef.current) return;

    trees.forEach((tree, i) => {
      // Trunk
      const scale = tree.scale * 0.6; // Smaller trees as requested
      dummy.position.set(tree.pos[0], 0, tree.pos[2]);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, (tree.id % 10) * 0.5, 0);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Leaves
      dummy.position.set(tree.pos[0], 3.5 * scale, tree.pos[2]);
      dummy.rotation.set(0, (tree.id % 10), 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      leafRef.current!.setMatrixAt(i, dummy.matrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    leafRef.current.instanceMatrix.needsUpdate = true;
    trunkRef.current.count = trees.length;
    leafRef.current.count = trees.length;
  }, [trees, dummy]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, 500]} castShadow receiveShadow>
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[leafGeometry, leafMaterial, 500]} castShadow />
    </group>
  );
}

const FARM_SIZE = 100; // Size of the interactive farm area
const BOUNDARY_SIZE = 150; // Size including the forest boundary

function ForestBoundary() {
  const trunkRef = React.useRef<THREE.InstancedMesh>(null);
  const leafRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  
  const trunkGeometry = React.useMemo(() => new THREE.CylinderGeometry(0.8, 1.5, 25, 8), []);
  const leafGeometry = React.useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(6 + Math.random() * 3, 8, 8);
      geo.translate((Math.random() - 0.5) * 8, 12 + i * 3, (Math.random() - 0.5) * 8);
      geometries.push(geo);
    }
    return mergeGeometries(geometries);
  }, []);

  React.useEffect(() => {
    if (!trunkRef.current || !leafRef.current) return;
    
    let count = 0;
    const spacing = 6; // Denser spacing
    const start = -BOUNDARY_SIZE / 2;
    const end = BOUNDARY_SIZE / 2;
    
    for (let x = start; x <= end; x += spacing) {
      for (let z = start; z <= end; z += spacing) {
        // Create multiple layers of trees for a solid wall effect
        if (Math.abs(x) > FARM_SIZE / 2 - 2 || Math.abs(z) > FARM_SIZE / 2 - 2) {
          const offset = (Math.random() - 0.5) * 3;
          const scale = 1.5 + Math.random() * 2;
          
          dummy.position.set(x + offset, 0, z + offset);
          dummy.scale.set(scale, scale, scale);
          dummy.rotation.set(0, Math.random() * Math.PI, 0);
          dummy.updateMatrix();
          trunkRef.current.setMatrixAt(count, dummy.matrix);
          
          dummy.position.set(x + offset, 8 * scale, z + offset);
          dummy.updateMatrix();
          leafRef.current.setMatrixAt(count, dummy.matrix);
          
          count++;
        }
      }
    }
    trunkRef.current.instanceMatrix.needsUpdate = true;
    leafRef.current.instanceMatrix.needsUpdate = true;
    trunkRef.current.count = count;
    leafRef.current.count = count;
  }, [dummy]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, 1000]} castShadow receiveShadow>
        <meshStandardMaterial color="#2d1b0d" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[leafGeometry, undefined, 1000]} castShadow>
        <meshStandardMaterial color="#0a2a0a" roughness={1} />
      </instancedMesh>
      {/* Solid wall to ensure nothing outside is visible */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[BOUNDARY_SIZE / 2 + 5, BOUNDARY_SIZE / 2 + 5, 60, 32, 1, true]} />
        <meshStandardMaterial color="#051505" side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function Grass({ count = 5000 }: { count?: number }) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  
  React.useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * FARM_SIZE;
      const z = (Math.random() - 0.5) * FARM_SIZE;
      const s = 0.2 + Math.random() * 0.4;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(s, s * 1.5, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow>
      <cylinderGeometry args={[0.01, 0.1, 2.5, 3]} />
      <meshStandardMaterial color="#4caf50" roughness={1} />
    </instancedMesh>
  );
}

function Pebbles({ count = 500 }: { count?: number }) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  
  React.useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * FARM_SIZE;
      const z = (Math.random() - 0.5) * FARM_SIZE;
      const s = 0.05 + Math.random() * 0.15;
      dummy.position.set(x, -0.1, z);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8d6e63" roughness={1} />
    </instancedMesh>
  );
}

function Fence({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  const size = (FARM_SIZE / 2) - 4;
  
  React.useEffect(() => {
    if (!meshRef.current) return;
    let idx = 0;
    const spacing = 2;
    
    // Four sides of a quadrant
    for (let i = -size / 2; i <= size / 2; i += spacing) {
      // North
      dummy.position.set(i, 0.5, -size / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);
      
      // South
      dummy.position.set(i, 0.5, size / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);
      
      // East
      dummy.position.set(size / 2, 0.5, i);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);
      
      // West
      dummy.position.set(-size / 2, 0.5, i);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(idx++, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, size]);

  return (
    <group position={position} rotation={rotation}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, 100]} castShadow>
        <boxGeometry args={[0.1, 1.2, 0.1]} />
        <meshStandardMaterial color="#5d4037" />
      </instancedMesh>
    </group>
  );
}

function Soil() {
  return (
    <group>
      {/* Interactive Farm Ground - Split into 4 quadrants */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[FARM_SIZE, FARM_SIZE]} />
        <meshStandardMaterial color="#66bb6a" roughness={1} />
      </mesh>

      {/* Quadrant Dividers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
        <planeGeometry args={[FARM_SIZE, 0.5]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.19, 0]}>
        <planeGeometry args={[FARM_SIZE, 0.5]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      
      {/* Fences for each quadrant */}
      <Fence position={[-FARM_SIZE/4, 0, -FARM_SIZE/4]} rotation={[0, 0, 0]} />
      <Fence position={[FARM_SIZE/4, 0, -FARM_SIZE/4]} rotation={[0, 0, 0]} />
      <Fence position={[-FARM_SIZE/4, 0, FARM_SIZE/4]} rotation={[0, 0, 0]} />
      <Fence position={[FARM_SIZE/4, 0, FARM_SIZE/4]} rotation={[0, 0, 0]} />
      
      <Grass count={3000} />
      <Pebbles count={300} />
    </group>
  );
}

// Global movement state for both keyboard and UI buttons
const globalMoveState = { forward: false, backward: false, left: false, right: false };

function MovementController() {
  const { camera } = useThree();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': globalMoveState.forward = true; break;
        case 's': globalMoveState.backward = true; break;
        case 'a': globalMoveState.left = true; break;
        case 'd': globalMoveState.right = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': globalMoveState.forward = false; break;
        case 's': globalMoveState.backward = false; break;
        case 'a': globalMoveState.left = false; break;
        case 'd': globalMoveState.right = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_state, delta) => {
    const speed = 12;
    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3(0, 0, Number(globalMoveState.backward) - Number(globalMoveState.forward));
    const sideVector = new THREE.Vector3(Number(globalMoveState.left) - Number(globalMoveState.right), 0, 0);

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed * delta)
      .applyQuaternion(camera.quaternion);

    camera.position.x += direction.x;
    camera.position.z += direction.z;
    // Keep camera at a fixed height above ground
    camera.position.y = 5;
  });

  return null;
}

function FarmScene({ trees, isDarkMode }: { trees: { id: number; pos: [number, number, number]; scale: number }[], isDarkMode: boolean }) {
  return (
    <>
      <fog attach="fog" args={[isDarkMode ? '#020617' : '#5d4037', 20, 120]} />
      
      {isDarkMode ? (
        <>
          <color attach="background" args={['#020617']} />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
          <ambientLight intensity={0.05} />
          <directionalLight 
            position={[-50, 80, -50]} 
            intensity={0.8} 
            color="#94a3b8" 
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          {/* Moon */}
          <group position={[-60, 80, -60]}>
            <mesh>
              <sphereGeometry args={[8, 32, 32]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            <pointLight intensity={10} distance={400} color="#cbd5e1" />
            {/* Moon Glow */}
            <mesh scale={2.5}>
              <sphereGeometry args={[8, 32, 32]} />
              <meshBasicMaterial color="#94a3b8" transparent opacity={0.15} />
            </mesh>
          </group>
        </>
      ) : (
        <>
          <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={2} />
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[100, 100, 100]} 
            intensity={2} 
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
          />
          {/* Sun */}
          <group position={[60, 80, 60]}>
            <mesh>
              <sphereGeometry args={[10, 32, 32]} />
              <meshBasicMaterial color="#fffde7" />
            </mesh>
            <pointLight intensity={15} distance={800} color="#fffde7" />
            {/* Sun Glow */}
            <mesh scale={3}>
              <sphereGeometry args={[10, 32, 32]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.15} />
            </mesh>
          </group>
          <Environment preset="sunset" />
        </>
      )}
      
      <Soil />
      <MovementController />
      <TreeInstanced trees={trees} />
      
      <Clouds material={THREE.MeshLambertMaterial}>
        <Cloud seed={10} bounds={[100, 20, 100]} volume={20} color="white" position={[0, 40, 0]} />
        <Cloud seed={20} bounds={[100, 20, 100]} volume={20} color="white" position={[50, 50, -50]} />
        <Cloud seed={30} bounds={[100, 20, 100]} volume={20} color="white" position={[-50, 45, 50]} />
      </Clouds>
    </>
  );
}

const knowledgeData: Record<string, Record<string, string>> = {
  'العقيدة': {
    'أسماء الله الحسنى الثابتة': 'أسماء الله الحسنى هي أسماء مدح وثناء وتمجيد لله، وهي توقيفية لا يجوز الزيادة فيها ولا النقصان. قال ابن القيم رحمه الله: "أسماء الله تعالى كلها أسماء مدح، فليس فيها اسم ذم ولا ما يتضمن ذماً". ومن الأدلة قوله تعالى: {وَلِلَّهِ الْأَسْمَاءُ الْحُسْنَى فَادْعُوهُ بِهَا}. ومن الأسماء الثابتة: الله، الرحمن، الرحيم، الملك، القدوس، السلام، المؤمن، المهيمن، العزيز، الجبار، المتكبر، الخالق، البارئ، المصور، الغفار، القهار، الوهاب، الرزاق، الفتاح، العليم، القابض، الباسط، الخافض، الرافع، المعز، المذل، السميع، البصير، الحكم، العدل، اللطيف، الخبير، الحليم، العظيم، الغفور، الشكور، العلي، الكبير، الحفيظ، المقيت، الحسيب، الجليل، الكريم، الرقيب، المجيب، الواسع، الحكيم، الودود، المجيد، الباعث، الشهيد، الحق، الوكيل، القوي، المتين، الولي، الحميد، المحصي، المبدئ، المعيد، المحيي، المميت، الحي، القيوم، الواجد، الماجد، الواحد، الأحد، الصمد، القادر، المقتدر، المقدم، المؤخر، الأول، الآخر، الظاهر، الباطن، الوالي، المتعالي، البر، التواب، المنتقم، العفو، الرؤوف، مالك الملك، ذو الجلال والإكرام، المقسط، الجامع، الغني، المغني، المانع، الضار، النافع، النور، الهادي، البديع، الباقي، الوارث، الرشيد، الصبور.',
    'إثبات علو الله على العرش': 'عقيدة أهل السنة والجماعة أن الله تعالى مستوٍ على عرشه، بائن من خلقه، كما قال تعالى في سبعة مواضع من كتابه: {الرَّحْمَنُ عَلَى الْعَرْشِ اسْتَوَى}. قال الإمام مالك رحمه الله لما سئل عن الاستواء: "الاستواء معلوم، والكيف مجهول، والإيمان به واجب، والسؤال عنه بدعة". وقال الأوزاعي: "كنا والتابعون متوافرون نقول: إن الله تعالى ذكره فوق عرشه، ونؤمن بما وردت به السنة من صفاته". وهذا إجماع السلف من الصحابة والتابعين، وهو مقتضى الفطرة والعقل الصريح.',
    'إثبات الصفات (اليد، الوجه، العين)': 'نثبت لله تعالى ما أثبته لنفسه من الصفات الخبرية كالوجه واليدين والعينين، إثباتاً بلا تمثيل وتنزيهًا بلا تعطيل. قال تعالى: {وَيَبْقَى وَجْهُ رَبِّكَ ذُو الْجلالِ وَالإِكْرَامِ}، وقال: {بَلْ يَدَاهُ مَبْسُوطَتَانِ}، وقال ﷺ في الدجال: "إن الله ليس بأعور". قال الإمام الشافعي: "لله أسماء وصفات جاء بها كتابه وأخبر بها نبيه ﷺ، لا يسع أحداً من خلق الله قامت عليه الحجة ردها". فنحن نثبتها حقيقة لا مجازاً، وننفي عنها مشابهة صفات المخلوقين.',
    'منهج السلف في الأسماء والصفات': 'منهج السلف الصالح هو الإيمان بما جاء في الكتاب والسنة من غير تحريف ولا تعطيل، ومن غير تكييف ولا تمثيل. قال الإمام أحمد بن حنبل رحمه الله: "نصف الله بما وصف به نفسه، ولا نتعدى القرآن والحديث". وقال نعيم بن حماد شيخ البخاري: "من شبه الله بخلقه فقد كفر، ومن جحد ما وصف الله به نفسه فقد كفر، وليس ما وصف الله به نفسه ولا رسوله تشبيهاً". فالقاعدة هي قوله تعالى: {لَيْسَ كَمِثْلِهِ شَيْءٌ وَهُوَ السَّمِيعُ الْبَصِيرُ}.',
    'الولاء والبراء': 'هو الحب في الله والبغض في الله، وهو أوثق عرى الإيمان. قال ﷺ: "من أحب في الله وأبغض في الله وأعطى لله ومنع لله فقد استكمل الإيمان". ومعناه محبة المؤمنين ونصرتهم، وبغض الكافرين ومعاداتهم في دينهم، مع العدل معهم وعدم ظلمهم.',
    'توحيد الألوهية': 'هو إفراد الله تعالى بالعبادة، فلا يصرف شيء من أنواع العبادة لغير الله، كالدعاء والذبح والنذر والتوكل والخوف والرجاء. قال تعالى: {وَمَا أُمِرُوا إِلَّا لِيَعْبُدُوا اللَّهَ مُخْلِصِينَ لَهُ الدِّينَ حُنَفَاءَ}. وهذا هو جوهر دعوة الرسل جميعاً، وهو الذي وقع فيه النزاع بين الرسل وأممهم.',
    'توحيد الربوبية': 'هو إفراد الله تعالى بأفعاله، كالخلق والرزق والإحياء والإماتة والتدبير. وهذا النوع أقر به المشركون في الجملة، كما قال تعالى: {وَلَئِن سألتهم مَّنْ خَلَقَهُمْ لَيَقُولُنَّ اللَّهُ}. ولكنه وحده لا يدخل العبد في الإسلام حتى يقر بتوحيد الألوهية.',
  },
  'الفقه': {
    'فقه الطهارة (توسع)': 'الطهارة لغة: النظافة، وشرعاً: رفع الحدث وزوال الخبث. \n1. المياه: الماء طهور (باق على خلقته) ونجس (تغير بنجاسة).\n2. الوضوء: فروضه ستة (غسل الوجه، اليدين، مسح الرأس، غسل الرجلين، الترتيب، الموالاة). سننه (السواك، التسمية، المضمضة والاستنشاق).\n3. الغسل: موجباته (الجنابة، الحيض، النفاس، الموت، الإسلام للكافر). صفته المجزئة: النية وتعميم البدن بالماء.\n4. التيمم: يباح عند فقد الماء أو تضرر باستعماله. صفته: ضربة واحدة للوجه والكفين.',
    'فقه الصلاة (توسع)': 'الصلاة هي الركن الثاني من أركان الإسلام.\n1. شروطها: (الإسلام، العقل، التمييز، دخول الوقت، الطهارة، ستر العورة، اجتناب النجاسة، استقبال القبلة، النية).\n2. أركانها: (القيام، تكبيرة الإحرام، قراءة الفاتحة، الركوع، الرفع منه، السجود على الأعضاء السبعة، الجلوس بين السجدتين، الطمأنينة، التشهد الأخير، الجلوس له، الصلاة على النبي ﷺ، الترتيب، التسليم).\n3. واجباتها: (تكبيرات الانتقال، قول سبحان ربي العظيم في الركوع، سمع الله لمن حمده للإمام والمنفرد، ربنا ولك الحمد للكل، سبحان ربي الأعلى في السجود، رب اغفر لي بين السجدتين، التشهد الأول والجلوس له).',
    'فقه الزكاة (توسع)': 'الزكاة واجبة في أربعة أصناف:\n1. بهيمة الأنعام (الإبل والبقر والغنم) بشروطها.\n2. الخارج من الأرض (الحبوب والثمار).\n3. الأثمان (الذهب والفضة والأوراق النقدية) إذا بلغت النصاب (85 جرام ذهب) وحال عليها الحول.\n4. عروض التجارة.\nمصارف الزكاة ثمانية ذكرت في سورة التوبة: {إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ...}.',
    'فقه الصيام والحج (توسع)': 'الصيام: ركنه الإمساك عن المفطرات من طلوع الفجر إلى غروب الشمس بنية. مفسداته: (الأكل والشرب عمداً، الجماع، التقيؤ عمداً، الحجامة، خروج دم الحيض والنفاس).\nالحج: أركانه أربعة: (الإحرام، الوقوف بعرفة، طواف الإفاضة، السعي). واجباته سبعة: (الإحرام من الميقات، الوقوف بعرفة إلى الغروب، المبيت بمزدلفة، المبيت بمنى ليالي التشريق، رمي الجمار، الحلق أو التقصير، طواف الوداع).',
    'فقه المعاملات': 'الأصل في المعاملات الإباحة إلا ما دل الدليل على تحريمه كالربا والغرر والقمار والظلم. ويشترط في البيع: التراضي، أهلية المتعاقدين، أن يكون المعقود عليه مباح النفع، مقدوراً على تسليمه، معلوماً برؤية أو وصف.',
  },
  'الحديث': {
    'أهمية السنة النبوية': 'السنة هي الوحي الثاني، وهي شارحة للقرآن ومبينة لمجمله. قال ﷺ: "ألا إني أوتيت القرآن ومثله معه". وقال الإمام البربهاري: "الإسلام هو السنة، والسنة هي الإسلام". ولا يستقيم إيمان عبد حتى يؤمن بالسنة ويعمل بها ويقدمها على قول كل أحد.',
    'أقسام الحديث': 'ينقسم الحديث من حيث القبول والرد إلى:\n1. الصحيح: ما اتصل سنده بنقل العدل الضابط عن مثله إلى منتهاه من غير شذوذ ولا علة.\n2. الحسن: ما اتصل سنده بنقل العدل الذي خف ضبطه.\n3. الضعيف: ما لم يجتمع فيه صفات الصحيح ولا الحسن.\nوينقسم من حيث عدد الرواة إلى متواتر وآحاد.',
    'الكتب الستة الأصول': 'هي الكتب التي اعتمدها العلماء كأصول للحديث النبوي:\n1. صحيح البخاري (أصح الكتب بعد القرآن).\n2. صحيح مسلم.\n3. سنن أبي داود.\n4. سنن الترمذي.\n5. سنن النسائي.\n6. سنن ابن ماجه.',
    'مصطلح الحديث': 'هو علم يعرف به حال الراوي والمروي من حيث القبول والرد. ومن أهم مباحثه: معرفة المتصل والمنقطع، والمعضل والمرسل، والشاذ والمنكر، والموضوع والمقلوب. وهذا العلم من مفاخر الأمة الإسلامية لحفظ دينها.',
  },
  'السيرة': {
    'العهد المكي والمدني': 'السيرة النبوية هي التطبيق العملي للإسلام.\nالعهد المكي (13 سنة): ركز على غرس التوحيد والصبر على الأذى. من أحداثه: نزول الوحي، الجهر بالدعوة، الهجرة إلى الحبشة، الإسراء والمعراج.\nالعهد المدني (10 سنوات): بناء الدولة وتشريع الأحكام. من أحداثه: المؤاخاة، الغزوات (بدر، أحد، الخندق)، صلح الحديبية، فتح مكة، حجة الوداع، ووفاة النبي ﷺ.',
    'الشمائل المحمدية': 'هي صفات النبي ﷺ الخلقية والخُلقية. كان ﷺ أجود الناس، وأشجع الناس، وأحسن الناس وجهاً، وأطيبهم ريحاً. كان خلقه القرآن، متواضعاً، رحيماً، لا يغضب لنفسه، بل يغضب إذا انتهكت حرمات الله.',
    'غزوات الرسول ﷺ': 'بلغت غزواته ﷺ 27 غزوة، قاتل في 9 منها بنفسه. ومن أهمها: بدر (الفرقان)، أحد (الابتلاء)، الخندق (الأحزاب)، خيبر (فتح حصون اليهود)، حنين، وتبوك (العسرة). وكان الهدف منها إعلاء كلمة الله وحماية الدعوة.',
  },
  'اللغة العربية': {
    'علوم اللغة العربية': 'اللغة العربية هي وعاء الوحي، وعلومها اثنا عشر علماً، أهمها:\n1. النحو: لمعرفة أحكام أواخر الكلمات.\n2. الصرف: لمعرفة بنية الكلمة وتصريفها.\n3. البلاغة: (المعاني، البيان، البديع) لمعرفة أسرار الفصاحة.\n4. اللغة والمتن: لمعرفة معاني المفردات.\nتعلمها فرض كفاية، وقد يكون فرض عين فيما يتوقف عليه فهم القرآن والسنة.',
    'أهمية اللغة في فهم الدين': 'قال عمر بن الخطاب رضي الله عنه: "تعلموا العربية فإنها من دينكم". فلا يمكن فهم القرآن والسنة فهماً صحيحاً إلا بمعرفة لسان العرب، وقواعد لغتهم، وأساليب بيانهم. وكثير من البدع نشأت بسبب الجهل باللغة العربية.',
  },
  'الوعظ': {
    'أعمال القلوب': 'هي الأصل في العبادة، وتشمل: الإخلاص، المحبة، الخوف، الرجاء، التوكل، الصبر، الشكر. قال ابن القيم: "أعمال القلوب هي المحركة لأعمال الجوارح".',
    'الاستعداد للموت': 'الموت هو الحقيقة الكبرى، والاستعداد له يكون بالتوبة النصوح، ورد المظالم، والإكثار من العمل الصالح، وترك المحرمات. قال ﷺ: "أكثروا ذكر هاذم اللذات".',
    'التوبة النصوح': 'شروطها: الإقلاع عن الذنب، الندم على ما فات، العزم على عدم العودة، ورد المظالم إلى أهلها. قال تعالى: {يَا أَيُّهَا الَّذِينَ آمَنُوا تُوبُوا إِلَى اللَّهِ تَوْبَةً نَّصُوحًا}.',
    'بر الوالدين': 'هو من أعظم القربات بعد توحيد الله. قال تعالى: {وَقَضَى رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا}. ويشمل طاعتهما في غير معصية، والنفقة عليهما، والدعاء لهما.',
  }
};

const adhkarData: Record<string, { hadith: string; items: string[] }> = {
  'أذكار الصباح': {
    hadith: 'قال ﷺ: "من قال حين يصبح: سبحان الله وبحمده مائة مرة؛ حطت خطايا وإن كانت مثل زبد البحر".',
    items: [
      'أصبحنا وأصبح الملك لله والحمد لله، لا إله إلا الله وحده لا شريك له.',
      'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور.',
      'سيد الاستغفار: اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك...',
      'رضيت بالله رباً وبالإسلام ديناً وبمحمد ﷺ نبياً.',
      'يا حي يا قيوم برحمتك أستغيث أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين.'
    ]
  },
  'أذكار المساء': {
    hadith: 'قال ﷺ: "من قرأ بالآيتين من آخر سورة البقرة في ليلة كفتاه".',
    items: [
      'أمسينا وأمسى الملك لله والحمد لله، لا إله إلا الله وحده لا شريك له.',
      'اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير.',
      'أعوذ بكلمات الله التامات من شر ما خلق.',
      'اللهم إني أسألك العفو والعافية في الدنيا والآخرة.',
      'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم.'
    ]
  },
  'أذكار بعد الصلاة': {
    hadith: 'قال ﷺ: "من سبح الله في دبر كل صلاة ثلاثاً وثلاثين... غفرت خطاياه وإن كانت مثل زبد البحر".',
    items: [
      'أستغفر الله (ثلاثاً)، اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام.',
      'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.',
      'اللهم لا مانع لما أعطيت ولا معطي لما منعت ولا ينفع ذا الجد منك الجد.',
      'قراءة آية الكرسي، والمعوذات (الإخلاص، الفلق، الناس).',
      'التسبيح (33)، التحميد (33)، التكبير (33)، وتمام المائة: لا إله إلا الله وحده لا شريك له.'
    ]
  },
  'أذكار النوم': {
    hadith: 'قال ﷺ: "إذا أويت إلى فراشك فاقرأ آية الكرسي... لن يزال عليك من الله حافظ".',
    items: [
      'باسمك ربي وضعت جنبي وبك أرفعه، إن أمسكت نفسي فارحمها وإن أرسلتها فاحفظها.',
      'اللهم قني عذابك يوم تبعث عبادك.',
      'باسمك اللهم أموت وأحيا.',
      'قراءة سورة الملك المنجية من عذاب القبر.',
      'نفث في الكفين وقراءة المعوذات ومسح ما استطاع من الجسد.'
    ]
  },
  'أذكار الاستيقاظ': {
    hadith: 'قال ﷺ: "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور".',
    items: [
      'الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور.',
      'الحمد لله الذي عافاني في جسدي ورد علي روحي وأذن لي بذكره.',
      'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، سبحان الله والحمد لله ولا إله إلا الله والله أكبر ولا حول ولا قوة إلا بالله.'
    ]
  },
  'فضل الذكر': {
    hadith: 'قال ﷺ: "ألا أنبئكم بخير أعمالكم... ذكر الله تعالى".',
    items: [
      'الذكر طمأنينة للقلب: {أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ}.',
      'الذكر سبب لذكر الله للعبد: {فَاذْكُرُونِي أَذْكُرْكُمْ}.',
      'الذكر يحط الخطايا ويرفع الدرجات.',
      'الذكر حصن حصين من الشيطان.',
      'الذاكرون الله كثيراً والذاكرات أعد الله لهم مغفرة وأجراً عظيماً.'
    ]
  }
};

// --- Main App Component ---
export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [location, setLocation] = useState<string>('مكة المكرمة');
  const [trees, setTrees] = useState<{ id: number; pos: [number, number, number]; scale: number }[]>([]);
  const [dhikrCount, setDhikrCount] = useState(0);
  const [customDhikr, setCustomDhikr] = useState('');
  const [misbahaCounts, setMisbahaCounts] = useState<Record<string, number>>({
    'سبحان الله': 0,
    'الحمد لله': 0,
    'لا إله إلا الله': 0,
    'الله أكبر': 0,
    'أستغفر الله': 0,
    'اللهم صل على محمد': 0
  });
  const [selectedAdhkarCategory, setSelectedAdhkarCategory] = useState<string | null>(null);

  // Quran Reader State
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [isLoadingQuran, setIsLoadingQuran] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<{ surah: string; number: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeAyahMenu, setActiveAyahMenu] = useState<number | null>(null);
  const [selectedReciter, setSelectedReciter] = useState<string>('ar.alafasy');
  const [selectedTafsir, setSelectedTafsir] = useState<string>('ar.muyassar');
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const [selectedAyahForTafsir, setSelectedAyahForTafsir] = useState<Ayah | null>(null);
  const [tafsirContent, setTafsirContent] = useState<string | null>(null);
  const [activeAyahAudio, setActiveAyahAudio] = useState<number | null>(null);
  const [quranMode, setQuranMode] = useState<'read' | 'listen' | 'tafsir'>('read');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const ayahAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const reciters: Reciter[] = [
    { id: 'ar.alafasy', name: 'مشاري العفاسي', server: 'https://server8.mp3quran.net/afs/' },
    { id: 'ar.muhammadluhaidan', name: 'محمد اللحيدان', server: 'https://server12.mp3quran.net/lhdan/' },
    { id: 'ar.husary', name: 'محمود خليل الحصري', server: 'https://server13.mp3quran.net/husr/' },
    { id: 'ar.minshawi', name: 'محمد صديق المنشاوي', server: 'https://server10.mp3quran.net/minsh/' },
    { id: 'ar.abdulbasitmurattal', name: 'عبدالباسط عبدالصمد', server: 'https://server7.mp3quran.net/basit/' },
    { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', server: 'https://server12.mp3quran.net/maher/' },
    { id: 'ar.sudais', name: 'عبدالرحمن السديس', server: 'https://server11.mp3quran.net/sds/' },
    { id: 'ar.shuraym', name: 'سعود الشريم', server: 'https://server7.mp3quran.net/shur/' },
  ];

  const tafsirs: Tafsir[] = [
    { id: 'ar.muyassar', name: 'التفسير الميسر' }
  ];

  const dhikrs = [
    "سبحان الله وبحمده",
    "سبحان الله",
    "سبحان الله العظيم",
    "الله أكبر",
    "لا إله إلا الله",
    "الحمد لله"
  ];

  useEffect(() => {
    // Apply dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Fetch Prayer Times
    const fetchPrayerTimes = async () => {
      try {
        const res = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Mecca&country=Saudi+Arabia&method=4');
        const data = await res.json();
        if (data.data) {
          setPrayerTimes({
            Fajr: data.data.timings.Fajr,
            Dhuhr: data.data.timings.Dhuhr,
            Asr: data.data.timings.Asr,
            Maghrib: data.data.timings.Maghrib,
            Isha: data.data.timings.Isha
          });
        }
      } catch (e) {
        console.error("Error fetching prayer times", e);
      }
    };

    // Fetch Random Verse
    const fetchRandomVerse = async () => {
      try {
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${randomAyah}/ar.alafasy`);
        const data = await res.json();
        if (data.data) {
          setVerse({
            text: data.data.text,
            surah: data.data.surah.name,
            number: data.data.numberInSurah
          });
        }
      } catch (e) {
        console.error("Error fetching verse", e);
      }
    };

    fetchPrayerTimes();
    fetchRandomVerse();
    fetchSurahs();
  }, []);

  const fetchSurahs = async () => {
    try {
      const res = await fetch('https://api.alquran.cloud/v1/surah');
      const data = await res.json();
      setSurahs(data.data);
    } catch (e) {
      console.error("Error fetching surahs", e);
    }
  };

  const fetchAyahs = async (surahNumber: number) => {
    setIsLoadingQuran(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
      const data = await res.json();
      setAyahs(data.data.ayahs);
      if (data.data.ayahs.length > 0) {
        setCurrentPage(data.data.ayahs[0].page);
      }
    } catch (e) {
      console.error("Error fetching ayahs", e);
    } finally {
      setIsLoadingQuran(false);
    }
  };

  useEffect(() => {
    if (showTafsirModal && selectedAyahForTafsir) {
      fetchTafsir(selectedAyahForTafsir);
    }
  }, [selectedTafsir]);

  const fetchTafsir = async (ayah: Ayah) => {
    setTafsirContent(null);
    setSelectedAyahForTafsir(ayah);
    setShowTafsirModal(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${selectedSurah?.number}:${ayah.numberInSurah}/${selectedTafsir}`);
      const data = await res.json();
      if (data.data) {
        setTafsirContent(data.data.text);
      }
    } catch (e) {
      console.error("Error fetching tafsir", e);
      setTafsirContent("عذراً، حدث خطأ أثناء تحميل التفسير.");
    }
  };

  const handleBookmarkClick = (bookmark: Bookmark) => {
    const surah = surahs.find(s => s.number === bookmark.surahNumber);
    if (surah) {
      handleSurahClick(surah);
      setQuranMode('read');
      // Fetch the page for this specific ayah
      fetch(`https://api.alquran.cloud/v1/ayah/${bookmark.surahNumber}:${bookmark.ayahNumber}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) setCurrentPage(data.data.page);
        });
      
      // Still try to scroll if we are in text mode (listen/tafsir)
      setTimeout(() => {
        const element = document.getElementById(`ayah-${bookmark.ayahNumber}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-islamic-green/30');
          setTimeout(() => element.classList.remove('ring-4', 'ring-islamic-green/30'), 3000);
        }
      }, 1500);
    }
  };

  const playAyahAudio = (ayah: Ayah) => {
    if (ayahAudioRef.current) {
      ayahAudioRef.current.src = `https://cdn.islamic.network/quran/audio/128/${selectedReciter}/${selectedSurah?.number * 1000 + ayah.numberInSurah}.mp3`; // This is a placeholder logic, usually it's surah:ayah
      // Correct API for single ayah audio: https://api.alquran.cloud/v1/ayah/262/ar.alafasy
      const ayahId = `${selectedSurah?.number}:${ayah.numberInSurah}`;
      ayahAudioRef.current.src = `https://cdn.islamic.network/quran/audio/128/${selectedReciter}/${ayah.number}.mp3`;
      ayahAudioRef.current.play();
      setActiveAyahAudio(ayah.number);
    }
  };

  const handleSurahClick = (surah: Surah) => {
    setSelectedSurah(surah);
    setFlipDirection('next');
    fetchAyahs(surah.number);
    const reciterObj = reciters.find(r => r.id === selectedReciter);
    const paddedNumber = String(surah.number).padStart(3, '0');
    setAudioUrl(`${reciterObj?.server}${paddedNumber}.mp3`);
    setIsAudioPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setLastRead({ surah: surah.name, number: surah.number });
    localStorage.setItem('hasanat_last_read', JSON.stringify({ surah: surah.name, number: surah.number }));
  };

  useEffect(() => {
    const saved = localStorage.getItem('hasanat_last_read');
    if (saved) setLastRead(JSON.parse(saved));
    
    const savedBookmarks = localStorage.getItem('hasanat_bookmarks');
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
  }, []);

  useEffect(() => {
    if (selectedSurah) {
      const reciterObj = reciters.find(r => r.id === selectedReciter);
      const paddedNumber = String(selectedSurah.number).padStart(3, '0');
      setAudioUrl(`${reciterObj?.server}${paddedNumber}.mp3`);
      setIsAudioPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [selectedReciter, selectedSurah]);

  const setAyahBookmark = (ayahNumber: number, type: BookmarkType) => {
    if (selectedSurah) {
      const newBookmark: Bookmark = {
        surahName: selectedSurah.name,
        surahNumber: selectedSurah.number,
        ayahNumber: ayahNumber,
        type: type
      };
      
      // Remove any existing bookmark of the SAME TYPE (unique bookmark per color/type)
      const filtered = bookmarks.filter(b => b.type !== type);
      const updated = [...filtered, newBookmark];
      
      setBookmarks(updated);
      localStorage.setItem('hasanat_bookmarks', JSON.stringify(updated));
      setActiveAyahMenu(null);
    }
  };

  const getBookmarkColor = (type: BookmarkType) => {
    switch(type) {
      case 'fast': return 'bg-amber-400';
      case 'reflection': return 'bg-blue-400';
      case 'memorization': return 'bg-emerald-400';
      case 'general': return 'bg-rose-400';
      default: return 'bg-islamic-gold';
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsAudioPlaying(!isAudioPlaying);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'تطبيق حسنات',
          text: 'تطبيق إسلامي متكامل للقراءة والاستماع والتعلم',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('نظام المشاركة غير مدعوم في هذا المتصفح، يمكنك نسخ الرابط يدوياً.');
    }
  };

  const addTree = () => {
    if (trees.length >= 500) {
      alert("وصلت للحد الأقصى من الأشجار (500 نخلة)");
      return;
    }
    
    const margin = 10;
    const pos: [number, number, number] = [
      (Math.random() - 0.5) * (FARM_SIZE - margin), 
      0, 
      (Math.random() - 0.5) * (FARM_SIZE - margin)
    ];
    
    const newTree = {
      id: Date.now(),
      pos,
      scale: 0.8 + Math.random() * 1.2
    };
    setTrees(prev => [...prev, newTree]);
    setDhikrCount(prev => prev + 1);
    
    // Visual feedback
    if (window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
  };

  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto overflow-hidden shadow-2xl relative transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-islamic-bg text-slate-900'}`}>
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <button 
          onClick={() => setActiveSection('settings')}
          className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400 dark:text-slate-500"
        >
          <Settings size={20} />
        </button>
        <h1 className="text-3xl font-bold text-islamic-green dark:text-emerald-500">حسنات</h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4">
        <AnimatePresence mode="wait">
          {activeSection === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Prayer Times Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-islamic-green dark:text-emerald-500">
                    <MapPin size={18} />
                    <span className="font-medium">{location}</span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">الأحد، ٢٢ فبراير</span>
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  {prayerTimes && Object.entries(prayerTimes).map(([name, time]) => (
                    <div key={name} className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">{name}</span>
                      <span className="text-sm font-bold text-islamic-green dark:text-emerald-400">{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Random Verse */}
              <div className="text-center py-8 px-4 bg-islamic-green/5 dark:bg-emerald-500/10 rounded-3xl border border-islamic-green/10 dark:border-emerald-500/20">
                <p className="quran-text text-2xl text-islamic-green dark:text-emerald-400 leading-relaxed mb-4 italic">
                  "{verse?.text}"
                </p>
                <p className="text-xs text-islamic-green/60 dark:text-emerald-500/60">
                  سورة {verse?.surah} - آية {verse?.number}
                </p>
              </div>

              {/* Quran Options */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { setQuranMode('read'); setActiveSection('quran-reader'); }}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 hover:bg-islamic-green dark:hover:bg-emerald-600 hover:text-white transition-all group"
                  >
                    <Book className="mb-3 text-islamic-green dark:text-emerald-500 group-hover:text-white" size={32} />
                    <span className="font-bold dark:text-slate-200 group-hover:text-white">القرآن الكريم مكتوب</span>
                  </button>
                  <button 
                    onClick={() => { setQuranMode('listen'); setActiveSection('quran-reader'); }}
                    className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 hover:bg-islamic-green dark:hover:bg-emerald-600 hover:text-white transition-all group"
                  >
                    <Volume2 className="mb-3 text-islamic-green dark:text-emerald-500 group-hover:text-white" size={32} />
                    <span className="font-bold dark:text-slate-200 group-hover:text-white">استماع القرآن</span>
                  </button>
                </div>
                <button 
                  onClick={() => { setQuranMode('tafsir'); setActiveSection('quran-reader'); }}
                  className="w-full flex items-center justify-center gap-4 p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 hover:bg-islamic-green dark:hover:bg-emerald-600 hover:text-white transition-all group"
                >
                  <BookOpen className="text-islamic-green dark:text-emerald-500 group-hover:text-white" size={32} />
                  <span className="font-bold text-xl dark:text-slate-200 group-hover:text-white">تفسير القرآن الكريم</span>
                </button>

                <button 
                  onClick={() => setActiveSection('adhkar')}
                  className="w-full flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-islamic-green/10 to-emerald-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-3xl shadow-sm border border-islamic-green/20 dark:border-emerald-500/30 hover:scale-[1.02] transition-all group"
                >
                  <Star className="text-islamic-green dark:text-emerald-500" size={32} />
                  <span className="font-bold text-xl text-slate-800 dark:text-white">الأذكار النبوية</span>
                </button>
              </div>
            </motion.div>
          )}

          {activeSection === 'adhkar' && (
            <motion.div
              key="adhkar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setActiveSection('home')} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400">
                  <ChevronLeft className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-islamic-green dark:text-emerald-500">الأذكار</h2>
                <div className="w-10" />
              </div>

              {selectedAdhkarCategory ? (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedAdhkarCategory(null)}
                    className="flex items-center gap-2 text-islamic-green dark:text-emerald-500 font-bold"
                  >
                    <ChevronLeft className="rotate-180" size={18} />
                    <span>العودة للأقسام</span>
                  </button>

                  <div className="p-6 bg-islamic-green/5 dark:bg-emerald-500/10 rounded-3xl border border-islamic-green/10 dark:border-emerald-500/20">
                    <p className="text-islamic-green dark:text-emerald-400 font-medium text-center leading-relaxed italic">
                      {adhkarData[selectedAdhkarCategory].hadith}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {adhkarData[selectedAdhkarCategory].items.map((item, idx) => (
                      <div key={idx} className="p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 text-right">
                        <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed quran-text">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {Object.keys(adhkarData).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedAdhkarCategory(cat)}
                      className="flex items-center justify-between p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 hover:border-islamic-green dark:hover:border-emerald-500 transition-all group"
                    >
                      <ChevronLeft className="text-slate-300 group-hover:text-islamic-green" />
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg dark:text-slate-200">{cat}</span>
                        <div className="w-12 h-12 rounded-2xl bg-islamic-green/10 dark:bg-emerald-500/10 flex items-center justify-center text-islamic-green dark:text-emerald-500">
                          {cat.includes('صباح') && <Sunrise size={24} />}
                          {cat.includes('مساء') && <Sunset size={24} />}
                          {cat.includes('صلاة') && <List size={24} />}
                          {cat.includes('نوم') && <Bed size={24} />}
                          {cat.includes('استيقاظ') && <CloudSun size={24} />}
                          {cat.includes('فضل') && <Star size={24} />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'misbaha' && (
            <motion.div
              key="misbaha"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-8 py-4"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold text-islamic-green dark:text-emerald-500 mb-2">المسبحة الإلكترونية</h2>
                <p className="text-slate-400 dark:text-slate-500">اذكر الله يذكرك</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {misbahaCounts && Object.entries(misbahaCounts).map(([dhikr, count]) => (
                  <div key={dhikr} className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setMisbahaCounts(prev => ({ ...prev, [dhikr]: 0 }))}
                        className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <RotateCcw size={20} />
                      </button>
                      <div className="text-center min-w-[60px]">
                        <span className="text-3xl font-bold text-islamic-green dark:text-emerald-400">{count}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setMisbahaCounts(prev => ({ ...prev, [dhikr]: prev[dhikr] + 1 }))}
                      className="flex-1 mr-4 py-4 px-6 bg-islamic-green/5 dark:bg-emerald-500/10 rounded-2xl text-right hover:bg-islamic-green/10 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                    >
                      <span className="text-xl font-bold text-slate-800 dark:text-white quran-text">{dhikr}</span>
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setMisbahaCounts(Object.fromEntries(Object.keys(misbahaCounts).map(k => [k, 0])))}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                <span>تصفير جميع العدادات</span>
              </button>

              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-black/5 dark:border-white/5 space-y-4">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">إضافة ذكر مخصص</h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={customDhikr}
                    onChange={(e) => setCustomDhikr(e.target.value)}
                    placeholder="اكتب الذكر هنا..."
                    className="flex-1 bg-slate-50 dark:bg-slate-700 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-islamic-green"
                  />
                  <button 
                    onClick={() => {
                      if (customDhikr.trim()) {
                        setMisbahaCounts(prev => ({ ...prev, [customDhikr]: 0 }));
                        setCustomDhikr('');
                      }
                    }}
                    className="bg-islamic-green text-white p-3 rounded-xl"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'quran-reader' && (
            <motion.div
              key="quran-reader"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4 pb-12"
            >
              {!selectedSurah ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setActiveSection('home')} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400">
                      <ChevronLeft className="rotate-180" />
                    </button>
                    <h2 className="text-xl font-bold text-islamic-green dark:text-emerald-500">القرآن الكريم</h2>
                    <div className="w-10" />
                  </div>

                  <div className="relative mb-6">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      placeholder="بحث عن سورة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 rounded-2xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-islamic-green/20 dark:focus:ring-emerald-500/20 shadow-sm dark:text-slate-200"
                    />
                  </div>

                  {lastRead && !searchQuery && (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="p-4 bg-islamic-gold/10 dark:bg-amber-500/10 rounded-2xl border border-islamic-gold/20 dark:border-amber-500/20 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] text-islamic-gold dark:text-amber-500 font-bold uppercase tracking-wider">آخر سورة</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{lastRead.surah}</p>
                        </div>
                        <button 
                          onClick={() => {
                            const s = surahs.find(x => x.number === lastRead.number);
                            if (s) handleSurahClick(s);
                          }}
                          className="mt-2 bg-islamic-gold dark:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm w-fit"
                        >
                          متابعة
                        </button>
                      </div>
                      
                      {bookmarks.length > 0 && (
                        <div className="p-4 bg-islamic-green/10 dark:bg-emerald-500/10 rounded-2xl border border-islamic-green/20 dark:border-emerald-500/20 flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] text-islamic-green dark:text-emerald-500 font-bold uppercase tracking-wider">العلامات ({bookmarks.length})</p>
                            <div className="flex gap-1 mt-1">
                              {bookmarks.slice(-3).map((b, i) => (
                                <div key={i} className={`w-2 h-2 rounded-full ${getBookmarkColor(b.type)}`} />
                              ))}
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              const b = bookmarks[bookmarks.length - 1];
                              const s = surahs.find(x => x.number === b.surahNumber);
                              if (s) handleSurahClick(s);
                            }}
                            className="mt-2 bg-islamic-green dark:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm w-fit"
                          >
                            آخر علامة
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {surahs
                      .filter(s => s.name.includes(searchQuery) || s.englishName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((surah) => (
                      <button
                        key={surah.number}
                        onClick={() => handleSurahClick(surah)}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 hover:border-islamic-green/30 dark:hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-islamic-green/10 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-islamic-green dark:text-emerald-500 font-bold text-sm">
                            {surah.number}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{surah.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{surah.numberOfAyahs} آية • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</p>
                          </div>
                        </div>
                        <ChevronLeft size={18} className="text-slate-300 dark:text-slate-600" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm min-h-[60vh]">
                  <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setSelectedSurah(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400">
                      <ChevronLeft className="rotate-180" />
                    </button>
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-islamic-green dark:text-emerald-500">{selectedSurah.name}</h2>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <button 
                          onClick={() => setShowReciterModal(true)}
                          className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400 flex items-center gap-1"
                        >
                          <Volume2 size={10} />
                          {reciters.find(r => r.id === selectedReciter)?.name}
                        </button>
                        <button 
                          onClick={() => setShowTafsirModal(true)}
                          className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400 flex items-center gap-1"
                        >
                          <Book size={10} />
                          {tafsirs.find(t => t.id === selectedTafsir)?.name}
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={toggleAudio}
                      className={`p-3 rounded-full shadow-lg transition-all ${isAudioPlaying ? 'bg-rose-500 text-white' : 'bg-islamic-green dark:bg-emerald-600 text-white'}`}
                    >
                      {isAudioPlaying ? <Moon size={20} /> : <Play size={20} />}
                    </button>
                    <a 
                      href={audioUrl} 
                      download={`${selectedSurah.name}.mp3`}
                      className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-200 transition-all"
                      title="تحميل السورة"
                    >
                      <Download size={20} />
                    </a>
                  </div>

                  {audioUrl && (
                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      onEnded={() => setIsAudioPlaying(false)}
                      className="hidden"
                    />
                  )}

                  <audio 
                    ref={ayahAudioRef} 
                    onEnded={() => setActiveAyahAudio(null)}
                    className="hidden"
                  />

                  {quranMode === 'listen' ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-8">
                      <div className="relative">
                        <div className={`w-48 h-48 rounded-full border-8 border-islamic-green/10 flex items-center justify-center transition-all ${isAudioPlaying ? 'scale-110 border-islamic-green/30' : ''}`}>
                          <div className={`w-40 h-40 rounded-full bg-islamic-green/5 flex items-center justify-center ${isAudioPlaying ? 'animate-pulse' : ''}`}>
                            <Volume2 size={64} className="text-islamic-green" />
                          </div>
                        </div>
                        {isAudioPlaying && (
                          <div className="absolute -inset-4 border-2 border-islamic-green/20 rounded-full animate-ping" />
                        )}
                      </div>

                      <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">سورة {selectedSurah.name}</h3>
                        <p className="text-slate-500 dark:text-slate-400">بصوت القارئ {reciters.find(r => r.id === selectedReciter)?.name}</p>
                      </div>

                      <div className="flex items-center gap-6">
                        <button 
                          onClick={toggleAudio}
                          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${isAudioPlaying ? 'bg-rose-500 text-white' : 'bg-islamic-green text-white'}`}
                        >
                          {isAudioPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
                        </button>
                      </div>

                      <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-islamic-green"
                          initial={{ width: 0 }}
                          animate={{ width: isAudioPlaying ? '100%' : '0%' }}
                          transition={{ duration: 300, ease: "linear" }}
                        />
                      </div>
                      
                      <p className="text-xs text-slate-400 dark:text-slate-500">جاري تشغيل السورة كاملة من المصدر المباشر</p>
                    </div>
                  ) : isLoadingQuran ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="w-12 h-12 border-4 border-islamic-green/20 dark:border-emerald-500/20 border-t-islamic-green dark:border-t-emerald-500 rounded-full animate-spin" />
                      <p className="text-slate-400 dark:text-slate-500 animate-pulse">جاري تحميل الآيات...</p>
                    </div>
                  ) : !selectedSurah ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <BookOpen size={64} className="text-slate-200 mb-4" />
                      <h3 className="text-xl font-bold text-slate-400">اختر سورة للبدء</h3>
                    </div>
                  ) : (
                    <div className="space-y-8 quran-text text-3xl leading-[2.5] text-slate-800 dark:text-slate-200 text-center">
                      {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
                        <p className="text-islamic-green dark:text-emerald-500 mb-8">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
                      )}
                      <div className="flex flex-wrap justify-center gap-x-2 gap-y-6">
                        {ayahs.map((ayah) => {
                          const ayahBookmark = bookmarks.find(b => b.surahNumber === selectedSurah.number && b.ayahNumber === ayah.numberInSurah);
                          return (
                            <div key={ayah.number} id={`ayah-${ayah.numberInSurah}`} className="relative group/ayah flex flex-col items-center">
                              <span 
                                onClick={() => quranMode === 'tafsir' && fetchTafsir(ayah)}
                                className={`inline-block px-1 rounded-lg transition-colors cursor-pointer ${ayahBookmark ? `${getBookmarkColor(ayahBookmark.type)}/30 ring-1 ring-${getBookmarkColor(ayahBookmark.type)}/50` : ''} hover:bg-islamic-green/5 dark:hover:bg-emerald-500/5`}
                              >
                                {ayah.text}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setActiveAyahMenu(activeAyahMenu === ayah.number ? null : ayah.number); }}
                                  className={`inline-flex items-center justify-center w-8 h-8 mx-2 text-xs border border-islamic-gold/30 dark:border-amber-500/30 rounded-full font-sans font-bold transition-all ${ayahBookmark ? `${getBookmarkColor(ayahBookmark.type)} text-white border-none` : 'text-islamic-gold dark:text-amber-500 hover:bg-islamic-gold hover:text-white'} ${activeAyahAudio === ayah.number ? 'ring-2 ring-islamic-green dark:ring-emerald-500 animate-pulse' : ''}`}
                                >
                                  {ayah.numberInSurah}
                                </button>
                              </span>
                              
                              {activeAyahMenu === ayah.number && (
                                <div className="absolute bottom-full mb-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-black/5 p-3 flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-bottom-2 min-w-[160px]">
                                  <div className="flex gap-2 justify-center border-b border-black/5 pb-2">
                                    <button onClick={() => setAyahBookmark(ayah.numberInSurah, 'fast')} className="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-sm" title="ختمة سريعة" />
                                    <button onClick={() => setAyahBookmark(ayah.numberInSurah, 'reflection')} className="w-6 h-6 rounded-full bg-blue-400 border-2 border-white shadow-sm" title="تدبر" />
                                    <button onClick={() => setAyahBookmark(ayah.numberInSurah, 'memorization')} className="w-6 h-6 rounded-full bg-emerald-400 border-2 border-white shadow-sm" title="حفظ" />
                                    <button onClick={() => setAyahBookmark(ayah.numberInSurah, 'general')} className="w-6 h-6 rounded-full bg-rose-400 border-2 border-white shadow-sm" title="عام" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button 
                                      onClick={() => fetchTafsir(ayah)}
                                      className="flex items-center justify-center gap-1 py-1.5 bg-slate-50 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300"
                                    >
                                      <BookOpen size={12} />
                                      تفسير
                                    </button>
                                    <button 
                                      onClick={() => playAyahAudio(ayah)}
                                      className="flex items-center justify-center gap-1 py-1.5 bg-islamic-green/10 rounded-lg text-[10px] font-bold text-islamic-green"
                                    >
                                      <Play size={12} />
                                      استماع
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'farm' && (
            <motion.div
              key="farm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0"
            >
              <div className="h-full w-full relative">
                <Canvas shadows>
                  <PerspectiveCamera makeDefault position={[60, 60, 60]} />
                  <FarmScene trees={trees} isDarkMode={isDarkMode} />
                  <OrbitControls 
                    enableDamping 
                    dampingFactor={0.05} 
                    maxPolarAngle={Math.PI / 2.1} 
                    minDistance={20} 
                    maxDistance={150} 
                  />
                </Canvas>
                
                {/* Farm UI Overlay */}
                <div className="absolute top-20 left-0 right-0 px-6 pointer-events-none flex flex-col items-center gap-2">
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-islamic-green/20 inline-block text-center"
                  >
                    <p className="text-lg font-black text-islamic-green dark:text-emerald-500">مزرعة الأذكار</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">أشجارك في الجنة: {trees.length} / 400</p>
                    <div className="flex gap-1 mt-1 justify-center">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-sm border border-black/10 ${trees.length > i * 100 ? 'bg-islamic-green' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </motion.div>
                  <div className="bg-black/40 backdrop-blur-sm rounded-full px-4 py-1 text-[10px] text-white font-bold">
                    استخدم الأزرار بالأسفل للتحرك والذكر لزراعة النخيل
                  </div>
                </div>

                <div className="absolute bottom-32 left-0 right-0 px-6 flex flex-wrap justify-center gap-2">
                  {dhikrs.map((text) => (
                    <button
                      key={text}
                      onClick={addTree}
                      className="bg-islamic-green dark:bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg active:scale-95 transition-transform"
                    >
                      {text}
                    </button>
                  ))}
                </div>

                {/* Movement Controls UI - Moved higher to avoid overlap */}
                <div className="absolute bottom-60 left-6 flex flex-col items-center gap-1 pointer-events-auto">
                  <button 
                    onMouseDown={() => globalMoveState.forward = true} 
                    onMouseUp={() => globalMoveState.forward = false}
                    onTouchStart={() => globalMoveState.forward = true}
                    onTouchEnd={() => globalMoveState.forward = false}
                    className="w-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-islamic-green dark:text-emerald-500 border border-white/20 dark:border-white/5 active:bg-white/80 dark:active:bg-slate-700 shadow-sm"
                  >
                    <ChevronLeft className="rotate-90" size={20} />
                  </button>
                  <div className="flex gap-1">
                    <button 
                      onMouseDown={() => globalMoveState.left = true} 
                      onMouseUp={() => globalMoveState.left = false}
                      onTouchStart={() => globalMoveState.left = true}
                      onTouchEnd={() => globalMoveState.left = false}
                      className="w-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-islamic-green dark:text-emerald-500 border border-white/20 dark:border-white/5 active:bg-white/80 dark:active:bg-slate-700 shadow-sm"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      onMouseDown={() => globalMoveState.backward = true} 
                      onMouseUp={() => globalMoveState.backward = false}
                      onTouchStart={() => globalMoveState.backward = true}
                      onTouchEnd={() => globalMoveState.backward = false}
                      className="w-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-islamic-green dark:text-emerald-500 border border-white/20 dark:border-white/5 active:bg-white/80 dark:active:bg-slate-700 shadow-sm"
                    >
                      <ChevronLeft className="-rotate-90" size={20} />
                    </button>
                    <button 
                      onMouseDown={() => globalMoveState.right = true} 
                      onMouseUp={() => globalMoveState.right = false}
                      onTouchStart={() => globalMoveState.right = true}
                      onTouchEnd={() => globalMoveState.right = false}
                      className="w-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl flex items-center justify-center text-islamic-green dark:text-emerald-500 border border-white/20 dark:border-white/5 active:bg-white/80 dark:active:bg-slate-700 shadow-sm"
                    >
                      <ChevronLeft className="rotate-180" size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-6">
                {(selectedKnowledgeCategory || selectedSubCategory) && (
                  <button 
                    onClick={() => {
                      if (selectedSubCategory) setSelectedSubCategory(null);
                      else setSelectedKnowledgeCategory(null);
                    }} 
                    className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm"
                  >
                    <ChevronLeft className="rotate-180" />
                  </button>
                )}
                <h2 className="text-xl font-bold text-islamic-green dark:text-emerald-500">
                  {selectedSubCategory || selectedKnowledgeCategory || 'موسوعة العلم'}
                </h2>
                <div className="w-10" />
              </div>

              {!selectedKnowledgeCategory ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: 'العقيدة', icon: <Moon className="text-blue-500" /> },
                    { name: 'الفقه', icon: <BookOpen className="text-emerald-500" /> },
                    { name: 'الحديث', icon: <Sun className="text-amber-500" /> },
                    { name: 'السيرة', icon: <MapPin className="text-rose-500" /> },
                    { name: 'اللغة العربية', icon: <GraduationCap className="text-indigo-500" /> },
                    { name: 'الوعظ', icon: <Volume2 className="text-purple-500" /> },
                  ].map((item) => (
                    <button
                      key={item.name}
                      onClick={() => setSelectedKnowledgeCategory(item.name)}
                      className="flex flex-col items-center p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-black/5 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-2xl">
                        {item.icon}
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                    </button>
                  ))}
                </div>
              ) : !selectedSubCategory ? (
                <div className="space-y-3">
                  {knowledgeData[selectedKnowledgeCategory] ? Object.keys(knowledgeData[selectedKnowledgeCategory]).map((sub, i) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedSubCategory(sub)}
                      className="w-full text-right p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/5 hover:border-islamic-green/30 transition-all flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200">{sub}</span>
                      <ChevronLeft size={16} className="text-slate-300" />
                    </button>
                  )) : (
                    <div className="text-center py-20 text-slate-400 italic">
                      جاري إضافة المحتوى لهذا القسم...
                    </div>
                  )}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-black/5"
                >
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-lg text-right">
                    {knowledgeData[selectedKnowledgeCategory][selectedSubCategory]}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
          {activeSection === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setActiveSection('home')} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400">
                  <ChevronLeft className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold text-islamic-green dark:text-emerald-500">الإعدادات والخيارات</h2>
                <div className="w-10" />
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-black/5">
                <div className="p-4 border-b border-black/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                      {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">الوضع الليلي</span>
                  </div>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-islamic-green' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'right-7' : 'right-1'}`} />
                  </button>
                </div>

                <button 
                  onClick={handleShare}
                  className="w-full p-4 border-b border-black/5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                      <Share2 size={20} />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">مشاركة التطبيق</span>
                  </div>
                  <ChevronLeft size={18} className="text-slate-300" />
                </button>

                <button 
                  onClick={() => setShowSupportModal(true)}
                  className="w-full p-4 border-b border-black/5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                      <HelpCircle size={20} />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">الدعم والمساعدة</span>
                  </div>
                  <ChevronLeft size={18} className="text-slate-300" />
                </button>

                <button 
                  onClick={() => setShowAboutModal(true)}
                  className="w-full p-4 border-b border-black/5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                      <Info size={20} />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">حول التطبيق</span>
                  </div>
                  <ChevronLeft size={18} className="text-slate-300" />
                </button>

                <a 
                  href="https://instagram.com/is_d03" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-100 text-pink-600 rounded-xl">
                      <User size={20} />
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">تابعني على انستقرام</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">is_d03</span>
                    <ChevronLeft size={18} className="text-slate-300" />
                  </div>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showReciterModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[40px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">اختر القارئ</h3>
                <button onClick={() => setShowReciterModal(false)} className="text-slate-400">إغلاق</button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {reciters.map((r) => (
                  <button 
                    key={r.id}
                    onClick={() => {
                      setSelectedReciter(r.id);
                      setShowReciterModal(false);
                      if (isAudioPlaying) {
                        setIsAudioPlaying(false);
                        if (audioRef.current) audioRef.current.pause();
                      }
                    }}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${selectedReciter === r.id ? 'bg-islamic-green text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                  >
                    <span className="font-bold">{r.name}</span>
                    {selectedReciter === r.id && <Check size={18} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showTafsirModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">التفسير</h3>
                <button onClick={() => setShowTafsirModal(false)} className="text-slate-400">إغلاق</button>
              </div>
              
              {tafsirs.length > 1 && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {tafsirs.map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setSelectedTafsir(t.id)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedTafsir === t.id ? 'bg-islamic-green text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto text-right">
                {selectedAyahForTafsir ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-islamic-green/5 dark:bg-emerald-500/5 rounded-2xl border border-islamic-green/10 dark:border-emerald-500/10">
                      <p className="quran-text text-xl text-islamic-green dark:text-emerald-400 leading-relaxed">
                        {selectedAyahForTafsir.text}
                      </p>
                      <p className="text-[10px] text-islamic-green/60 dark:text-emerald-500/60 mt-2">آية {selectedAyahForTafsir.numberInSurah}</p>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
                      {tafsirContent || (
                        <div className="flex justify-center py-4">
                          <div className="w-6 h-6 border-2 border-islamic-green/20 border-t-islamic-green rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-6 mt-6 border-t border-black/5 dark:border-white/5">
                      <button 
                        disabled={selectedAyahForTafsir.numberInSurah === ayahs.length}
                        onClick={() => {
                          const next = ayahs.find(a => a.numberInSurah === selectedAyahForTafsir.numberInSurah + 1);
                          if (next) fetchTafsir(next);
                        }}
                        className="flex items-center gap-2 text-islamic-green dark:text-emerald-500 font-bold disabled:opacity-30"
                      >
                        <ChevronLeft size={18} />
                        <span>الآية التالية</span>
                      </button>
                      <button 
                        disabled={selectedAyahForTafsir.numberInSurah === 1}
                        onClick={() => {
                          const prev = ayahs.find(a => a.numberInSurah === selectedAyahForTafsir.numberInSurah - 1);
                          if (prev) fetchTafsir(prev);
                        }}
                        className="flex items-center gap-2 text-islamic-green dark:text-emerald-500 font-bold disabled:opacity-30"
                      >
                        <span>الآية السابقة</span>
                        <ChevronLeft size={18} className="rotate-180" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 italic py-10">اختر آية لعرض تفسيرها</p>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showAboutModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-islamic-green/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <h1 className="text-4xl font-bold text-islamic-green">ح</h1>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">تطبيق حسنات</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                تطبيق إسلامي يهدف لمساعدة المسلم في حياته اليومية من خلال تلاوة القرآن وتعلم العلوم الشرعية وتنمية مزرعة الحسنات الافتراضية.
              </p>
              <div className="space-y-3 mb-8">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span className="text-slate-400">الإصدار</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">1.0.0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span className="text-slate-400">المطور</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">فريق حسنات</span>
                </div>
                <a 
                  href="https://instagram.com/is_d03" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl hover:scale-[1.02] transition-transform"
                >
                  <span className="text-purple-600 dark:text-purple-400 font-bold">تابعني على انستقرام</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">is_d03</span>
                </a>
              </div>
              <button 
                onClick={() => setShowAboutModal(false)}
                className="w-full py-4 bg-islamic-green text-white rounded-2xl font-bold shadow-lg shadow-islamic-green/20"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}

        {showSupportModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">الدعم والمساعدة</h3>
              <div className="space-y-4 mb-8">
                <p className="text-slate-600 dark:text-slate-400 text-right leading-relaxed">
                  إذا واجهت أي مشكلة أو كان لديك اقتراح لتحسين التطبيق، يسعدنا تواصلك معنا عبر البريد الإلكتروني:
                </p>
                <div className="p-4 bg-islamic-green/5 border border-islamic-green/10 rounded-2xl text-center">
                  <span className="font-bold text-islamic-green">support@hasanat-app.com</span>
                </div>
                <p className="text-xs text-slate-400 text-center">نسعى دائماً لتقديم أفضل تجربة لمستخدمينا</p>
              </div>
              <button 
                onClick={() => setShowSupportModal(false)}
                className="w-full py-4 bg-islamic-green text-white rounded-2xl font-bold shadow-lg shadow-islamic-green/20"
              >
                فهمت
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className={`fixed bottom-6 left-6 right-6 backdrop-blur-xl rounded-3xl shadow-2xl border p-2 flex justify-around items-center z-50 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800/90 border-white/5' : 'bg-white/90 border-black/5'}`}>
        <button
          onClick={() => setActiveSection('home')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeSection === 'home' ? 'bg-islamic-green dark:bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <Home size={24} />
          <span className="text-[10px] mt-1 font-bold">الرئيسية</span>
        </button>
        <button
          onClick={() => setActiveSection('farm')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeSection === 'farm' ? 'bg-islamic-green dark:bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <Sprout size={24} />
          <span className="text-[10px] mt-1 font-bold">المزرعة</span>
        </button>
        <button
          onClick={() => setActiveSection('knowledge')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeSection === 'knowledge' ? 'bg-islamic-green dark:bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <BookOpen size={24} />
          <span className="text-[10px] mt-1 font-bold">العلم</span>
        </button>
        <button
          onClick={() => setActiveSection('misbaha')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeSection === 'misbaha' ? 'bg-islamic-green dark:bg-emerald-600 text-white shadow-lg' : 'text-slate-400 dark:text-slate-500'}`}
        >
          <RotateCcw size={24} />
          <span className="text-[10px] mt-1 font-bold">المسبحة</span>
        </button>
      </nav>
    </div>
  );
}
