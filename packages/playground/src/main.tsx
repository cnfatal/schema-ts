import { StrictMode } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { Playground } from "./Playground";
import { examples } from "./examples";
import { ThemeProvider } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ThemeProvider>
        <TooltipProvider>
          <Playground examples={examples} />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
