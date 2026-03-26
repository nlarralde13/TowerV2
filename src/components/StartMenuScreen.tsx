"use client";

interface StartMenuScreenProps {
  onStartGame: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
}

export function StartMenuScreen({ onStartGame, onOpenSettings, onExit }: StartMenuScreenProps) {
  return (
    <main className="start-menu-shell">
      <div className="start-menu-backdrop" aria-hidden="true" />
      <section className="start-menu-panel" aria-label="The Tower start menu">
        <div className="start-menu-title-wrap">
          <p className="start-menu-kicker">16-Bit Dungeon Extraction</p>
          <h1 className="start-menu-title">THE TOWER</h1>
        </div>

        <div className="start-menu-actions">
          <button type="button" className="start-menu-button" onClick={onStartGame}>
            Enter Terrune
          </button>
          <button type="button" className="start-menu-button" onClick={onOpenSettings}>
            Grim Settings
          </button>
          <button type="button" className="start-menu-button" onClick={onExit}>
            Leave The Gate
          </button>
          <button type="button" className="start-menu-button" disabled title="Login support is not yet available">
            Oath Login (Coming Soon)
          </button>
        </div>
      </section>
    </main>
  );
}
