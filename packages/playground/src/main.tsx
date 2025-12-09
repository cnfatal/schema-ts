import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Playground } from "./Playground";
import { examples } from "./examples";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Playground examples={examples} />
    </StrictMode>,
  );
}
