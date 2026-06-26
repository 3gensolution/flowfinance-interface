import Script from "next/script";

export const FooterScript = () => {
  // const trackAll = process.env.NEXT_PUBLIC_GUIDEAI_TRACK_ALL ?? 'false';
  // const behavioralTriggers = process.env.NEXT_PUBLIC_GUIDEAI_BEHAVIORAL_TRIGGERS ?? 'false';
  // const apiUrl = process.env.NEXT_PUBLIC_GUIDEAI_API_URL ?? 'https://api.3guideai.com';

  return (
    <>
      <Script
        src="https://cdn.3guideai.com/sdk/guideai-tracking.js"
        data-site-id="39bb4c66-9342-465a-95bb-02ee66ad4688"
        data-token="pk_live_LRuDCmTwv0HYf1Rt73e2Ocj_L1oH6yAI2UgMara53ww"
        data-track-all="true"
      />
      <Script
        src="https://cdn.3guideai.com/sdk/guideai.js"
        strategy="afterInteractive"
        data-site-id="39bb4c66-9342-465a-95bb-02ee66ad4688"
        data-token="pk_live_LRuDCmTwv0HYf1Rt73e2Ocj_L1oH6yAI2UgMara53ww"
        data-bubble-label="Awinfi"
        // data-api-url="https://api.3guideai.com"
        // data-cdn-url="https://cdn.3guideai.com/sdk/guideai.js"
        data-track-all="true"
        data-behavioral-triggers="true"

      />
    </>
  )
};

// data-api-url="http://localhost:8000"
// data-cdn-url="http://localhost:8000"
// data-api-url="https://api.3guideai.com"
// data-cdn-url="https://cdn.jsdelivr.net/gh/3gensolution/guideai-scanner@cdn-v0.1.5/cdn/guideai.js"
// data-site-id="39bb4c66-9342-465a-95bb-02ee66ad4688"
// data-token="pk_live_LRuDCmTwv0HYf1Rt73e2Ocj_L1oH6yAI2UgMara53ww"

{/* <Script
          src="/guideai.js"
          strategy="afterInteractive"
          data-site-id="dc692794-e79b-4959-bab6-75e5285193d6"
          data-token="pk_live_EfiwURAPRYwsEWY2p5EsStuGzJimo9SCWqFy4yliJeo"
          data-api-url="http://localhost:8000"
          data-cdn-url="http://localhost:8000"
          data-track-all="true"
          data-behavioral-triggers="true"
        /> */}
