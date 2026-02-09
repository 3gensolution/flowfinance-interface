import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { UseCases } from '@/components/landing/UseCases';
import { Trust } from '@/components/landing/Trust';
import { CTA } from '@/components/landing/CTA';

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ProductPreview />
      <UseCases />
      <Trust />
      <CTA />
    </>
  );
}
