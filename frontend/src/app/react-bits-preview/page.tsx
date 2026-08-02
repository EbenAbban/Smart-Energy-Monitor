'use client'

import Antigravity from '@/components/react-bits/Antigravity'
import LaserFlow from '@/components/react-bits/LaserFlow'
import GradualBlur from '@/components/react-bits/GradualBlur'
import FuzzyText from '@/components/react-bits/FuzzyText'

export default function ReactBitsPreviewPage() {
  return (
    <div className="space-y-12 p-8">
      <section>
        <h2 className="mb-2 text-white">Antigravity</h2>
        <div style={{ width: '100%', height: '400px', position: 'relative' }}>
          <Antigravity count={150} magnetRadius={6} ringRadius={7} color="#FF9FFC" autoAnimate />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-white">LaserFlow</h2>
        <div style={{ height: '400px', position: 'relative', overflow: 'hidden', backgroundColor: '#120F17' }}>
          <LaserFlow color="#FF79C6" />
        </div>
      </section>

      <section style={{ position: 'relative', height: 300, overflow: 'hidden' }}>
        <h2 className="mb-2 text-white">GradualBlur</h2>
        <div style={{ height: '100%', overflowY: 'auto', padding: '2rem' }}>
          <p className="text-white">Scrollable content behind a gradual blur overlay.</p>
        </div>
        <GradualBlur target="parent" position="bottom" height="6rem" strength={2} divCount={5} curve="bezier" exponential opacity={1} />
      </section>

      <section>
        <h2 className="mb-2 text-white">FuzzyText</h2>
        <FuzzyText baseIntensity={0.2} hoverIntensity={0.5} enableHover>
          404
        </FuzzyText>
      </section>
    </div>
  )
}
