import { Suspense } from "react";
import { BuilderEditor } from "./builder-prototype";

// PROTOTYPE: Three drag-and-drop builder shells, switchable with ?variant=a|b|c.
export default function BuilderPrototypePage() {
  return (
    <div>
      <Suspense fallback={<div className="min-h-screen bg-muted" />}>
        <BuilderEditor showVariantSwitcher />
      </Suspense>
    </div>
  );
}
