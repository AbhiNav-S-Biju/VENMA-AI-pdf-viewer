import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { VenmaCat } from "../features/pet/VenmaCat";

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <VenmaCat className="app-brand__mark" mood="idle" size={34} motionless trackPointer={false} />
        <h1>VENMA</h1>
      </div>
      {children}
      <details className="settings-menu">
        <summary aria-label="Open workspace settings">
          <Icon name="settings" />
        </summary>
        <div className="settings-menu__popover">
          <strong>VENMA</strong>
          <span>Your PDFs and notes stay in this browser. Only the text you ask about is sent to the AI server.</span>
          <span className="settings-menu__status"><i aria-hidden="true" /> Local workspace ready</span>
        </div>
      </details>
    </header>
  );
}
