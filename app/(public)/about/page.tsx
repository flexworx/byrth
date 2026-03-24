import type { Metadata } from 'next'
import { AboutHero } from '@/components/about/AboutHero'
import { Mission } from '@/components/about/Mission'
import { Timeline } from '@/components/about/Timeline'
import { CTASection } from '@/components/home/CTASection'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Roosk was founded on a simple premise: infrastructure management should be intelligent, autonomous, and secure by default.',
}

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <Mission />
      <Timeline />
      <CTASection />
    </>
  )
}
