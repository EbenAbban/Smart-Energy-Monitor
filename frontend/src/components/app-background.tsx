'use client'

import dynamic from 'next/dynamic'

const GridScan = dynamic(() => import('@/components/react-bits/GridScan'), {
  ssr: false,
})

export default function AppBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <GridScan
        enableWebcam={false}
        linesColor="#1f2937"
        scanColor="#10b981"
        gridScale={0.12}
        scanOpacity={0.35}
        lineThickness={1}
        lineJitter={0.08}
        enablePost={false}
        bloomIntensity={0}
        chromaticAberration={0}
        noiseIntensity={0.005}
        scanDuration={2.5}
        scanDelay={2.5}
        fps={30}
        maxPixelRatio={1}
      />
    </div>
  )
}