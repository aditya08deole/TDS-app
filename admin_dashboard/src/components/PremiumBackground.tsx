import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { animate } from 'animejs'
import { useTheme } from '../context/ThemeContext'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;

  void main() {
    vec2 p = vUv;
    
    // Smooth liquid movement
    float n1 = sin(p.x * 1.5 + uTime * 0.2) * 0.5 + 0.5;
    float n2 = cos(p.y * 1.5 - uTime * 0.15) * 0.5 + 0.5;
    
    float w1 = smoothstep(0.0, 1.2, 1.0 - distance(p, vec2(0.3 + 0.1 * n1, 0.2 + 0.1 * n2)));
    float w2 = smoothstep(0.0, 1.2, 1.0 - distance(p, vec2(0.8 - 0.1 * n2, 0.8 - 0.1 * n1)));
    float w3 = smoothstep(0.0, 1.2, 1.0 - distance(p, vec2(0.4 + 0.2 * n1, 0.6 - 0.2 * n2)));
    float w4 = smoothstep(0.0, 1.2, 1.0 - distance(p, vec2(0.1 - 0.1 * n2, 0.9 + 0.1 * n1)));

    float totalWeight = w1 + w2 + w3 + w4;
    vec3 finalColor = (uColor1 * w1 + uColor2 * w2 + uColor3 * w3 + uColor4 * w4) / totalWeight;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

function LiquidMesh() {
    const { resolvedTheme } = useTheme()
    const meshRef = useRef<THREE.Mesh>(null!)
    
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color() },
        uColor2: { value: new THREE.Color() },
        uColor3: { value: new THREE.Color() },
        uColor4: { value: new THREE.Color() }
    }), [])

    useFrame((state) => {
        if (meshRef.current) {
            const material = meshRef.current.material as THREE.ShaderMaterial
            material.uniforms.uTime.value = state.clock.getElapsedTime()
            
            // Premium Muted Palette
            if (resolvedTheme === 'light') {
                material.uniforms.uColor1.value.lerp(new THREE.Color('#F0F4F8'), 0.05) // Soft Steel
                material.uniforms.uColor2.value.lerp(new THREE.Color('#E3EAF2'), 0.05) // Muted Sky
                material.uniforms.uColor3.value.lerp(new THREE.Color('#FFFFFF'), 0.05) 
                material.uniforms.uColor4.value.lerp(new THREE.Color('#F9FBFF'), 0.05)
            } else {
                material.uniforms.uColor1.value.lerp(new THREE.Color('#030508'), 0.05) // Deep Charcoal
                material.uniforms.uColor2.value.lerp(new THREE.Color('#0A0C10'), 0.05) // Rich Onyx
                material.uniforms.uColor3.value.lerp(new THREE.Color('#010204'), 0.05) // Near Black
                material.uniforms.uColor4.value.lerp(new THREE.Color('#0B0F15'), 0.05) // Midnight Blue-Grey
            }
        }
    })

    return (
        <mesh ref={meshRef}>
            <planeGeometry args={[20, 20]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
            />
        </mesh>
    )
}

function FloatingOrbs() {
    const orbsRef = useRef<THREE.Group>(null!)
    const orbColors = ['#0EA5E9', '#0891B2', '#6366F1', '#334155'] // Light blue, deep cyan, indigo, slate
    
    // Use useMemo to prevent re-creating the orbs on every render
    const orbsData = useMemo(() => {
        return Array.from({ length: 4 }).map((_, i) => ({
            position: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, -2),
            color: orbColors[i],
            size: 3 + Math.random() * 4
        }))
    }, [])

    useEffect(() => {
        if (orbsRef.current) {
             // Use anime.js for long, smooth cyclical movement
             animate(orbsRef.current.position, {
                x: [0.2, -0.2],
                y: [-0.2, 0.2],
                duration: 20000 + Math.random() * 10000,
                easing: 'easeInOutQuad',
                direction: 'alternate',
                loop: true
             });
        }
    }, [])

    useFrame((state) => {
        if (orbsRef.current) {
            const time = state.clock.getElapsedTime()
            orbsRef.current.children.forEach((child, i) => {
                const orb = child as THREE.Mesh
                orb.position.x += Math.sin(time * 0.2 + i) * 0.002
                orb.position.y += Math.cos(time * 0.15 + i) * 0.002
            })
        }
    })

    return (
        <group ref={orbsRef}>
            {orbsData.map((orb, i) => (
                <mesh key={i} position={orb.position}>
                    <circleGeometry args={[orb.size, 64]} />
                    <meshBasicMaterial 
                        color={orb.color} 
                        transparent 
                        opacity={0.08} 
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            ))}
        </group>
    )
}

export default function PremiumBackground() {
    return (
        <div className="fixed inset-0 w-full h-full -z-20 bg-[#000] overflow-hidden">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 2]}
            >
                <LiquidMesh />
                <FloatingOrbs />
                <ambientLight intensity={0.5} />
            </Canvas>
            
            {/* Subtle Grain Overlay */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
        </div>
    )
}
