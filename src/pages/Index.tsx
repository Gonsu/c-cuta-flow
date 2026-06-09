import { useState } from "react";
import { PantallaCelular } from "@/components/transit/PantallaCelular";
import { SplashScreen } from "@/components/transit/SplashScreen";
import { BannerOffline } from "@/components/transit/BannerOffline";

const Index = () => {
  const [splashListo, setSplashListo] = useState(false);

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-paper"
      style={{ width: "100vw", height: "100dvh" }}
    >
      <PantallaCelular />
      <BannerOffline />
      {!splashListo && <SplashScreen onDone={() => setSplashListo(true)} />}
    </main>
  );
};

export default Index;
