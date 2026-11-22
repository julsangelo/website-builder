import { Suspense } from "react";

import { BuilderEditor } from "./prototype/builder/builder-prototype";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-100" />}>
      <BuilderEditor />
    </Suspense>
  );
}
