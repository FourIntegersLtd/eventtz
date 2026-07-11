import { preload } from "react-dom";
import LandingMarketplace from "@/features/landing/LandingMarketplace";
import { HERO_VIDEO_SRC } from "@/features/landing/landingData";

preload(HERO_VIDEO_SRC, { as: "video" });

export default function Home() {
  return <LandingMarketplace />;
}
