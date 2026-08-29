import { Footer, Nav } from "./components/Shell";
import { Hero, Marquee } from "./components/Hero";
import { Pipeline } from "./components/Pipeline";
import { Formats } from "./components/Formats";
import { CodeExplorer } from "./components/CodeExplorer";
import { Guide } from "./components/Guide";
import { DeepDive, Faq } from "./components/Knowledge";

export default function App() {
  return (
    <div className="relative min-h-screen">
      <div className="stage-bg" aria-hidden="true" />
      <div className="stage-grid" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />

      <Nav />

      <main>
        <Hero />
        <Marquee />
        <Pipeline />
        <Formats />
        <CodeExplorer />
        <Guide />
        <DeepDive />
        <Faq />
      </main>

      <Footer />
    </div>
  );
}
