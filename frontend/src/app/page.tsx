import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Stats } from '@/components/landing/Stats';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <CTA />
    </>
  );
}
