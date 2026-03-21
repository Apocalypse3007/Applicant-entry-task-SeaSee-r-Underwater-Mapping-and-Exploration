import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'

const PANORAMAS = [
  {
    label: 'Soissons Cathedral',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Soissons_Cathedral_Interior_360x180%2C_Picardy%2C_France_-_Diliff.jpg',
  },
  {
    label: 'Laon Cathedral',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Laon_Cathedral_Interior_360x180%2C_Picardy%2C_France_-_Diliff.jpg',
  },
  {
    label: 'Schachtschleuse Waltrop',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Alte_Schachtschleuse_Waltrop_Panorama.jpg',
  },
]

type PanoramaPath = {
  to: number
  cue: string
  x: number
  y: number
  distance: string
}

type ProjectedPanoramaPath = PanoramaPath & {
  key: string
  screenX: number
  screenY: number
}

const PANORAMA_PATHS: Record<number, PanoramaPath[]> = {
  0: [
    { to: 1, cue: 'Passage to Laon Cathedral', x: 76, y: 40, distance: '18m' },
    { to: 2, cue: 'Passage to Schachtschleuse Waltrop', x: 23, y: 62, distance: '31m' },
  ],
  1: [
    { to: 0, cue: 'Passage to Soissons Cathedral', x: 28, y: 45, distance: '18m' },
    { to: 2, cue: 'Passage to Schachtschleuse Waltrop', x: 70, y: 60, distance: '24m' },
  ],
  2: [
    { to: 0, cue: 'Passage to Soissons Cathedral', x: 67, y: 37, distance: '31m' },
    { to: 1, cue: 'Passage to Laon Cathedral', x: 32, y: 64, distance: '24m' },
  ],
}

const getInitialPanoramaIndex = () => {
  const params = new URLSearchParams(window.location.search)
  const parsed = Number(params.get('p'))

  if (!Number.isInteger(parsed)) {
    return 0
  }

  return THREE.MathUtils.clamp(parsed, 0, PANORAMAS.length - 1)
}

const pathToDirection = (xPercent: number, yPercent: number) => {
  const u = xPercent / 100
  const v = yPercent / 100

  const theta = (u - 0.5) * Math.PI * 2
  const phi = v * Math.PI

  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ).normalize()
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const loaderRef = useRef<THREE.TextureLoader | null>(null)
  const activeTextureRef = useRef<THREE.Texture | null>(null)
  const requestIdRef = useRef(0)

  const [activeIndex, setActiveIndex] = useState(getInitialPanoramaIndex)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isViewerHovered, setIsViewerHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [projectedPaths, setProjectedPaths] = useState<ProjectedPanoramaPath[]>([])

  useEffect(() => {
    const container = mountRef.current

    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      1,
      1100,
    )
    camera.position.set(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const geometry = new THREE.SphereGeometry(500, 60, 40)
    geometry.scale(-1, 1, 1)

    const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

    materialRef.current = material
    cameraRef.current = camera

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loaderRef.current = loader

    const target = new THREE.Vector3()
    let lon = 0
    let lat = 0
    let pointerDown = false
    let pointerDownX = 0
    let pointerDownY = 0
    let lonOnPointerDown = 0
    let latOnPointerDown = 0
    let animationFrameId = 0

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true
      setIsDragging(true)
      pointerDownX = event.clientX
      pointerDownY = event.clientY
      lonOnPointerDown = lon
      latOnPointerDown = lat
      container.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) {
        return
      }

      lon = (pointerDownX - event.clientX) * 0.12 + lonOnPointerDown
      lat = (event.clientY - pointerDownY) * 0.12 + latOnPointerDown
    }

    const onPointerUp = (event: PointerEvent) => {
      pointerDown = false
      setIsDragging(false)

      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.03, 35, 95)
      camera.updateProjectionMatrix()
    }

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)

      lat = Math.max(-85, Math.min(85, lat))
      const phi = THREE.MathUtils.degToRad(90 - lat)
      const theta = THREE.MathUtils.degToRad(lon)

      target.set(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      )

      camera.lookAt(target)
      renderer.render(scene, camera)
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointerleave', onPointerUp)
    container.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)

    animate()

    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointerleave', onPointerUp)
      container.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)

      window.cancelAnimationFrame(animationFrameId)

      if (activeTextureRef.current) {
        activeTextureRef.current.dispose()
        activeTextureRef.current = null
      }

      geometry.dispose()
      material.dispose()
      renderer.dispose()
      cameraRef.current = null

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('p', String(activeIndex))

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [activeIndex])

  useEffect(() => {
    const material = materialRef.current
    const loader = loaderRef.current

    if (!material || !loader) {
      return
    }

    requestIdRef.current += 1
    const requestId = requestIdRef.current

    setIsLoading(true)
    setErrorMessage(null)

    loader.load(
      PANORAMAS[activeIndex].url,
      (texture) => {
        if (requestId !== requestIdRef.current) {
          texture.dispose()
          return
        }

        texture.colorSpace = THREE.SRGBColorSpace

        if (activeTextureRef.current) {
          activeTextureRef.current.dispose()
        }

        activeTextureRef.current = texture
        material.map = texture
        material.needsUpdate = true
        setIsLoading(false)
      },
      undefined,
      () => {
        if (requestId !== requestIdRef.current) {
          return
        }

        setErrorMessage(`Failed to load panorama image: ${PANORAMAS[activeIndex].url}`)
        setIsLoading(false)
      },
    )
  }, [activeIndex])

  useEffect(() => {
    const container = mountRef.current
    const camera = cameraRef.current

    if (!container || !camera || isDragging || isLoading || errorMessage) {
      setProjectedPaths([])
      return
    }

    let frameId = 0

    const updatePathOverlay = () => {
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)

      const nextPaths: ProjectedPanoramaPath[] = []

      for (const path of PANORAMA_PATHS[activeIndex] ?? []) {
        const direction = pathToDirection(path.x, path.y)
        const facing = direction.dot(cameraDirection)

        if (facing <= 0.2) {
          continue
        }

        const projected = direction.clone().multiplyScalar(500).project(camera)

        if (projected.z < -1 || projected.z > 1) {
          continue
        }

        if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
          continue
        }

        nextPaths.push({
          ...path,
          key: `${activeIndex}-${path.to}-${path.cue}`,
          screenX: (projected.x * 0.5 + 0.5) * 100,
          screenY: (-projected.y * 0.5 + 0.5) * 100,
        })
      }

      setProjectedPaths(nextPaths)
      frameId = window.requestAnimationFrame(updatePathOverlay)
    }

    frameId = window.requestAnimationFrame(updatePathOverlay)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeIndex, isDragging, isLoading, errorMessage])

  const showPaths = isViewerHovered && !isDragging && !isLoading && !errorMessage && projectedPaths.length > 0

  return (
    <div
      className="app-shell"
      onPointerLeave={() => {
        setIsViewerHovered(false)
        setIsDragging(false)
      }}
    >
      <header className="hud">
        <h1>SeaSee&apos;r Panorama Viewer</h1>
        <p>Drag to look around. Scroll to zoom. Hover to reveal paths.</p>
        <div className="panorama-list" role="tablist" aria-label="Choose panorama">
          {PANORAMAS.map((panorama, index) => (
            <button
              key={panorama.url}
              className={index === activeIndex ? 'active' : ''}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {panorama.label}
            </button>
          ))}
        </div>
        {isLoading && <p className="status">Loading panorama...</p>}
        {errorMessage && <p className="status error">{errorMessage}</p>}
      </header>

      <main
        ref={mountRef}
        className="viewer"
        aria-label="Panorama viewer"
        onPointerEnter={() => setIsViewerHovered(true)}
      />

      <div className={`path-overlay ${showPaths ? 'visible' : ''}`} aria-hidden={!showPaths}>
        <div className="path-core" />
        {projectedPaths.map((path) => (
          <button
            key={path.key}
            type="button"
            className="path-node"
            style={{ left: `${path.screenX}%`, top: `${path.screenY}%` }}
            onClick={() => setActiveIndex(path.to)}
          >
            <span className="path-distance">{path.distance}</span>
            <strong>{PANORAMAS[path.to].label}</strong>
            <span>{path.cue}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
