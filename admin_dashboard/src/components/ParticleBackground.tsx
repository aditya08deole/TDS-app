import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useTheme } from '../context/ThemeContext'

function Particles(props: any) {
    const ref = useRef<THREE.Points>(null!)
    const { resolvedTheme } = useTheme()

    // Generate random positions for particles
    const positions = useMemo(() => {
        const count = 200 // Number of particles
        const positions = new Float32Array(count * 3)

        for (let i = 0; i < count; i++) {
            // Random spread
            positions[i * 3] = (Math.random() - 0.5) * 10
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10
        }

        return positions
    }, [])

    useFrame((_state, delta) => {
        if (ref.current) {
            // Constant rotation
            ref.current.rotation.x -= delta / 30
            ref.current.rotation.y -= delta / 50
        }
    })

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points
                ref={ref}
                positions={positions}
                stride={3}
                frustumCulled={false}
                {...props}
            >
                <PointMaterial
                    transparent
                    color={resolvedTheme === 'dark' ? '#0A84FF' : '#007AFF'}
                    size={0.05}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={resolvedTheme === 'dark' ? 0.3 : 0.2}
                />
            </Points>
        </group>
    )
}

export default function ParticleBackground() {
    return (
        <div id="three-bg">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 75 }}
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 2]} // Handle high DPI screens
            >
                <Particles />
            </Canvas>
        </div>
    )
}
