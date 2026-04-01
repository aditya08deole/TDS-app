import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
    
    // Create animated noise/movement for the mesh points
    float n1 = sin(p.x * 2.0 + uTime * 0.5) * 0.5 + 0.5;
    float n2 = cos(p.y * 2.0 - uTime * 0.3) * 0.5 + 0.5;
    
    // Calculate weights for colors based on UV coordinates and noise
    float w1 = smoothstep(0.0, 1.0, 1.0 - distance(p, vec2(0.4 + 0.1 * n1, 0.1 + 0.1 * n2)));
    float w2 = smoothstep(0.0, 1.0, 1.0 - distance(p, vec2(0.9 - 0.1 * n2, 0.9 - 0.1 * n1)));
    float w3 = smoothstep(0.0, 1.0, 1.0 - distance(p, vec2(0.5 + 0.2 * n1, 0.5 - 0.2 * n2)));
    float w4 = smoothstep(0.0, 1.0, 1.0 - distance(p, vec2(0.2 - 0.1 * n2, 0.8 + 0.1 * n1)));

    float totalWeight = w1 + w2 + w3 + w4;
    vec3 finalColor = (uColor1 * w1 + uColor2 * w2 + uColor3 * w3 + uColor4 * w4) / totalWeight;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

function MeshGradient() {
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
            
            // Theme-aware color updates - Softened Pastel Palette
            if (resolvedTheme === 'light') {
                material.uniforms.uColor1.value.set('#F9FFFB') // White-mint
                material.uniforms.uColor2.value.set('#F5F9FF') // White-sky
                material.uniforms.uColor3.value.set('#FFFFFF') // Pure White
                material.uniforms.uColor4.value.set('#FFFEF9') // White-cream
            } else {
                material.uniforms.uColor1.value.set('#000000') // Pure Black
                material.uniforms.uColor2.value.set('#010101') // Near Black
                material.uniforms.uColor3.value.set('#000000') // Pure Black
                material.uniforms.uColor4.value.set('#020202') // Charcoal Mist
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

function DustParticles() {
    const pointsRef = useRef<THREE.Points>(null!)
    const count = 150
    
    const [[positions, speeds]] = useState(() => {
        const pos = new Float32Array(count * 3)
        const spd = new Float32Array(count)
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 15
            pos[i * 3 + 1] = (Math.random() - 0.5) * 15
            pos[i * 3 + 2] = (Math.random() - 0.5) * 5
            spd[i] = 0.001 + Math.random() * 0.003
        }
        return [pos, spd]
    })

    useFrame((state) => {
        if (pointsRef.current) {
            const time = state.clock.getElapsedTime()
            const geo = pointsRef.current.geometry as THREE.BufferGeometry
            const posAttr = geo.attributes.position as THREE.BufferAttribute
            
            for (let i = 0; i < count; i++) {
                // Subtle drifting movement
                posAttr.setY(i, posAttr.getY(i) + speeds[i] * Math.sin(time * 0.5 + i))
                posAttr.setX(i, posAttr.getX(i) + speeds[i] * Math.cos(time * 0.3 + i))
            }
            posAttr.needsUpdate = true
        }
    })

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={positions}
                    itemSize={3}
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.015}
                color="#ffffff"
                transparent
                opacity={0.15}
                blending={THREE.AdditiveBlending}
                sizeAttenuation
            />
        </points>
    )
}

export default function ParticleBackground() {
    return (
        <div id="three-bg" className="fixed inset-0 w-full h-full -z-10 bg-transparent overflow-hidden">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 50 }}
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 2]}
            >
                <MeshGradient />
                <DustParticles />
            </Canvas>
        </div>
    )
}
