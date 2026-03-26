"use client";

import { useState } from "react";
import { GameLoopScreen } from "../components/GameLoopScreen";
import { StartMenuScreen } from "../components/StartMenuScreen";

type LandingView = "menu" | "home_base";

export default function HomePage() {
  const [view, setView] = useState<LandingView>("menu");
  const [menuNotice, setMenuNotice] = useState<string | null>(null);

  if (view === "menu") {
    return (
      <>
        <StartMenuScreen
          onStartGame={() => {
            setMenuNotice(null);
            setView("home_base");
          }}
          onOpenSettings={() => {
            setMenuNotice("The grim settings ledger is still being forged.");
          }}
          onExit={() => {
            setMenuNotice("No true exit in browser mode. Close the tab to leave the gate.");
          }}
        />
        {menuNotice && <div className="start-menu-notice">{menuNotice}</div>}
      </>
    );
  }

  return <GameLoopScreen />;
}
