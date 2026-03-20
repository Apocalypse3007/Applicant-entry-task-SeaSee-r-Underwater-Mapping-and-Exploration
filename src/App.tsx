import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'

const PANORAMAS = [
  {
    label: 'Tunnel',
    url: 'https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg',
  },
  {
    label: 'Kandao',
    url: 'https://threejs.org/examples/textures/kandao3.jpg',
  },
  {
    label: 'Grid',
    url: 'https://threejs.org/examples/textures/equirectangular.png',
  },
]

const getInitialPanoramaIndex = () => {
  const params = new URLSearchParams(window.location.search)
  const parsed = Number(params.get('p'))

  if (!Number.isInteger(parsed)) {
    return 0
  }

  return THREE.MathUtils.clamp(parsed, 0, PANORAMAS.length - 1)
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const loaderRef = useRef<THREE.TextureLoader | null>(null)
  const activeTextureRef = useRef<THREE.Texture | null>(null)
  const requestIdRef = useRef(0)

  const [activeIndex, setActiveIndex] = useState(getInitialPanoramaIndex)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  return (
    <div className="app-shell">
      <header className="hud">
        <h1>SeaSee&apos;r Panorama Viewer</h1>
        <p>Drag to look around. Scroll to zoom.</p>
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

      <main ref={mountRef} className="viewer" aria-label="Panorama viewer" />
    </div>
  )
}

export default App
