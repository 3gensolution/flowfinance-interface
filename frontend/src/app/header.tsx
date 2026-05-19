import Script from "next/script";

export const FooterScript = () => {
    return (
        <Script
          src="https://cdn.jsdelivr.net/gh/3gensolution/guideai-scanner@cdn-v0.1.5/cdn/guideai.js"
          strategy="afterInteractive"
          data-site-id="39bb4c66-9342-465a-95bb-02ee66ad4688"
          data-token="pk_live_LRuDCmTwv0HYf1Rt73e2Ocj_L1oH6yAI2UgMara53ww"
          data-api-url="http://api.3guideai.com"
          data-cdn-url="https://cdn.jsdelivr.net/gh/3gensolution/guideai-scanner@cdn-v0.1.5/cdn/guideai.js"
          data-track-all="true"
          data-behavioral-triggers="true"
        />
    )
};

// data-api-url="http://localhost:8000"
// data-cdn-url="http://localhost:8000"
