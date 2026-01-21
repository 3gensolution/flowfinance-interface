'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface GalaxyParams {
  count: number;
  size: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
  insideColor: string;
  outsideColor: string;
}

interface MousePosition {
  x: number;
  y: number;
}

// Mouse position context for the 3D scene
function useMousePosition() {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Normalize mouse position to -1 to 1 range
      setMousePosition({
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return mousePosition;
}

function Galaxy({ mousePosition }: { mousePosition: MousePosition }) {
  const pointsRef = useRef<THREE.Points>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  const params: GalaxyParams = useMemo(() => ({
    count: 50000,
    size: 0.01,
    radius: 5,
    branches: 5,
    spin: 1,
    randomness: 0.2,
    randomnessPower: 3,
    insideColor: '#6366f1', // primary color (indigo)
    outsideColor: '#06b6d4', // accent color (cyan)
  }), []);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);

    const colorInside = new THREE.Color(params.insideColor);
    const colorOutside = new THREE.Color(params.outsideColor);

    for (let i = 0; i < params.count; i++) {
      const i3 = i * 3;

      // Position
      const radius = Math.random() * params.radius;
      const spinAngle = radius * params.spin;
      const branchAngle = ((i % params.branches) / params.branches) * Math.PI * 2;

      const randomX = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
      const randomY = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;
      const randomZ = Math.pow(Math.random(), params.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * params.randomness * radius;

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      // Color
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, radius / params.radius);

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    return { positions, colors };
  }, [params]);

  useFrame((state) => {
    if (pointsRef.current) {
      // Base rotation
      const baseRotationY = state.clock.elapsedTime * 0.05;

      // Mouse-influenced rotation (smooth interpolation)
      targetRotation.current.x = mousePosition.y * 0.3;
      targetRotation.current.y = mousePosition.x * 0.3;

      // Smooth lerp to target rotation
      pointsRef.current.rotation.x += (targetRotation.current.x - pointsRef.current.rotation.x) * 0.05;
      pointsRef.current.rotation.y = baseRotationY + targetRotation.current.y;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={params.size}
        sizeAttenuation={true}
        depthWrite={false}
        vertexColors={true}
        blending={THREE.AdditiveBlending}
        transparent={true}
        opacity={0.8}
      />
    </points>
  );
}

function Stars({ mousePosition }: { mousePosition: MousePosition }) {
  const starsRef = useRef<THREE.Points>(null);
  const targetPosition = useRef({ x: 0, y: 0 });

  const positions = useMemo(() => {
    const positions = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      starsRef.current.rotation.x = state.clock.elapsedTime * 0.01;

      // Subtle parallax effect on stars based on mouse
      targetPosition.current.x = mousePosition.x * 0.5;
      targetPosition.current.y = mousePosition.y * 0.5;

      starsRef.current.position.x += (targetPosition.current.x - starsRef.current.position.x) * 0.02;
      starsRef.current.position.y += (targetPosition.current.y - starsRef.current.position.y) * 0.02;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.005}
        sizeAttenuation={true}
        color="#ffffff"
        transparent={true}
        opacity={0.6}
      />
    </points>
  );
}

// Interactive particles that follow the mouse
function InteractiveParticles({ mousePosition }: { mousePosition: MousePosition }) {
  const particlesRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();

  const count = 200;
  const { positions, velocities, originalPositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 6;
      const z = (Math.random() - 0.5) * 4;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;

      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;
    }

    return { positions, velocities, originalPositions };
  }, []);

  useFrame(() => {
    if (particlesRef.current) {
      const positionAttribute = particlesRef.current.geometry.attributes.position;
      const posArray = positionAttribute.array as Float32Array;

      // Convert mouse position to world coordinates
      const mouseX = mousePosition.x * (viewport.width / 2);
      const mouseY = mousePosition.y * (viewport.height / 2);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Calculate distance from mouse
        const dx = mouseX - posArray[i3];
        const dy = mouseY - posArray[i3 + 1];
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Particles are attracted to mouse when close, repelled when very close
        const attractionRadius = 3;
        const repulsionRadius = 1;

        if (distance < attractionRadius && distance > 0.01) {
          const force = (attractionRadius - distance) / attractionRadius;

          if (distance < repulsionRadius) {
            // Repel
            velocities[i3] -= (dx / distance) * force * 0.02;
            velocities[i3 + 1] -= (dy / distance) * force * 0.02;
          } else {
            // Attract
            velocities[i3] += (dx / distance) * force * 0.01;
            velocities[i3 + 1] += (dy / distance) * force * 0.01;
          }
        }

        // Return to original position
        velocities[i3] += (originalPositions[i3] - posArray[i3]) * 0.01;
        velocities[i3 + 1] += (originalPositions[i3 + 1] - posArray[i3 + 1]) * 0.01;
        velocities[i3 + 2] += (originalPositions[i3 + 2] - posArray[i3 + 2]) * 0.01;

        // Apply friction
        velocities[i3] *= 0.95;
        velocities[i3 + 1] *= 0.95;
        velocities[i3 + 2] *= 0.95;

        // Update position
        posArray[i3] += velocities[i3];
        posArray[i3 + 1] += velocities[i3 + 1];
        posArray[i3 + 2] += velocities[i3 + 2];
      }

      positionAttribute.needsUpdate = true;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        sizeAttenuation={true}
        color="#a78bfa"
        transparent={true}
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Scene component that uses mouse position
function Scene({ mousePosition }: { mousePosition: MousePosition }) {
  return (
    <>
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.5} />
      <Galaxy mousePosition={mousePosition} />
      <Stars mousePosition={mousePosition} />
      <InteractiveParticles mousePosition={mousePosition} />
    </>
  );
}

export function SpiralGalaxy() {
  const mousePosition = useMousePosition();

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 2, 5], fov: 75 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <Scene mousePosition={mousePosition} />
      </Canvas>
    </div>
  );
}
