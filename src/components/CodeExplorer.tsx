import { useMemo, useState } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { PROJECT_FILES } from "../data/projectFilesExports";
import type { ProjectFile } from "../data/projectFilesCore";
import { CopyButton, Reveal, SectionHeading } from "./Shell";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("ini", ini);

const GROUP_ORDER = ["Ядро", "Экспорт", "Обвязка"] as const;

const GROUP_LABEL: Record<string, string> = {
  "Ядро": "ядро · dsp + mps",
  "Экспорт": "экспорт форматов",
  "Обвязка": "обвязка · cli + docs",
};

function FileIcon({ lang }: { lang: ProjectFile["lang"] }) {
  const color = lang === "python" ? "#43c9a2" : lang === "markdown" ? "#f2a33c" : "#8fa0a8";
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1.5h5.5L13 5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 1.5V5H13" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function CodeExplorer() {
  const [activePath, setActivePath] = useState(PROJECT_FILES[0].path);
  const active = PROJECT_FILES.find((f) => f.path === activePath) ?? PROJECT_FILES[0];
  const loc = active.code.split("\n").length;

  const wholeProject = useMemo(
    () =>
      PROJECT_FILES.map((f) => `# ${"=".repeat(64)}\n# ${f.path}\n# ${"=".repeat(64)}\n\n${f.code}`)
        .join("\n\n"),
    []
  );

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ group: g, files: PROJECT_FILES.filter((f) => f.group === g) })).filter(
        (g) => g.files.length > 0
      ),
    []
  );

  return (
    <section id="code" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            kicker="03 · Исходники"
            title="Весь пакет — 12 файлов, копируются в один клик"
            lead="Полная реализация bass2tabs. Соберите структуру каталогов, скопируйте файлы — и пакет готов к запуску через python -m bass2tabs. Лицензия MIT."
          />
          <Reveal delay={150}>
            <CopyButton text={wholeProject} label="Скопировать весь проект" copiedLabel="Проект в буфере" />
          </Reveal>
        </div>

        <Reveal delay={100} className="mt-12">
          <div className="overflow-hidden rounded-xl border border-line bg-ink-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
            {/* mobile file chips */}
            <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2.5 md:hidden">
              {PROJECT_FILES.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setActivePath(f.path)}
                  className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                    f.path === activePath
                      ? "border-amber/60 bg-amber/10 text-amber"
                      : "border-line text-dim"
                  }`}
                >
                  {f.path.split("/").pop()}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-[248px_1fr]">
              {/* sidebar */}
              <aside className="hidden border-r border-line bg-panel/60 px-3 py-4 md:block">
                <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  bass2tabs/ · дерево
                </p>
                {grouped.map(({ group, files }) => (
                  <div key={group} className="mb-4">
                    <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint/80">
                      {GROUP_LABEL[group]}
                    </p>
                    <ul className="space-y-0.5">
                      {files.map((f) => {
                        const isActive = f.path === activePath;
                        return (
                          <li key={f.path}>
                            <button
                              type="button"
                              onClick={() => setActivePath(f.path)}
                              className={`file-chip flex w-full cursor-pointer items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-left font-mono text-[11.5px] ${
                                isActive
                                  ? "border-amber bg-amber/10 text-amber"
                                  : "border-transparent text-dim hover:bg-panel-2 hover:text-paper"
                              }`}
                              title={f.note}
                            >
                              <FileIcon lang={f.lang} />
                              <span className="truncate">{f.path.split("/").pop()}</span>
                              <span className="ml-auto shrink-0 text-[9.5px] text-faint">
                                {f.code.split("\n").length}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </aside>

              {/* viewer */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel/40 px-4 py-3">
                  <FileIcon lang={active.lang} />
                  <span className="font-mono text-[12.5px] font-medium text-paper">{active.path}</span>
                  <span className="hidden font-mono text-[11px] text-faint sm:inline">· {active.note}</span>
                  <span className="ml-auto rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">
                    {loc} строк
                  </span>
                  <CopyButton text={active.code} compact />
                </div>
                <div className="code-scroll max-h-[620px] overflow-auto bg-[#10161b]">
                  <SyntaxHighlighter
                    language={active.lang}
                    style={vscDarkPlus}
                    showLineNumbers
                    lineNumberStyle={{ color: "#3a4a54", fontSize: "11px", minWidth: "2.6em" }}
                    customStyle={{
                      background: "transparent",
                      margin: 0,
                      padding: "18px 14px 26px 6px",
                      fontSize: "12.5px",
                      lineHeight: 1.72,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    wrapLongLines
                  >
                    {active.code}
                  </SyntaxHighlighter>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel/40 px-4 py-2.5">
                  <span className="font-mono text-[10.5px] text-faint">
                    python 3.10+ · utf-8 · без глобального состояния
                  </span>
                  <span className="font-mono text-[10.5px] text-faint">
                    {active.group === "Ядро" ? "torch · mps" : active.group === "Экспорт" ? "запись файла" : "точка входа"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
