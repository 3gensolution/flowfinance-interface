import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { UseCases } from '@/components/landing/UseCases';
import { Trust } from '@/components/landing/Trust';
import { StocksBanner } from '@/components/landing/StocksBanner';
import { CTA } from '@/components/landing/CTA';
import { TrackOnMount } from '@/components/guideai/TrackOnMount';

export default function Home() {
  return (
    <>
      <TrackOnMount event="pricing_page_view" props={{ page: 'home' }} />
      <Hero />
      <HowItWorks />
      <ProductPreview />
      <UseCases />
      <Trust />
      <StocksBanner />
      <CTA />
    </>
  );
}
