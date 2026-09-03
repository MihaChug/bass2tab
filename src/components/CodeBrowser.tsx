import { useEffect, useMemo, useState } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton, Reveal, SectionHeading } from "../ui";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("ini", ini);

export type ProjectFile = {
  path: string;
  lang: "python" | "markdown" | "ini";
  group: string;
  note: string;
};

export const FILE_MANIFEST: ProjectFile[] = [
  { path: "bass2tabs/__init__.py", lang: "python", group: "Пакет", note: "версия пакета" },
  { path: "bass2tabs/__main__.py", lang: "python", group: "Пакет", note: "python -m bass2tabs" },
  { path: "bass2tabs/cli.py", lang: "python", group: "Пакет", note: "аргументы, оркестрация, вывод" },
  { path: "bass2tabs/mps.py", lang: "python", group: "Ядро", note: "выбор устройства, --check" },
  { path: "bass2tabs/audio.py", lang: "python", group: "Ядро", note: "чтение + high-pass 32 Гц + ресемплинг" },
  { path: "bass2tabs/pitch.py", lang: "python", group: "Ядро", note: "CREPE на MPS, чанки, subprocess" },
  { path: "bass2tabs/notes.py", lang: "python", group: "Ядро", note: "гистерезис 0.6/0.35 + онсеты" },
  { path: "bass2tabs/text.py", lang: "python", group: "Ядро", note: "транслитерация в latin-1" },
  { path: "bass2tabs/export_midi.py", lang: "python", group: "Экспорт", note: "Standard MIDI File (mido)" },
  { path: "bass2tabs/export_xml.py", lang: "python", group: "Экспорт", note: "MusicXML partwise (UTF-8)" },
  { path: "bass2tabs/export_gp5.py", lang: "python", group: "Экспорт", note: "Guitar Pro 5 (PyGuitarPro)" },
  { path: "README.md", lang: "markdown", group: "Обвязка", note: "установка, флаги, диагностика" },
  { path: "requirements.txt", lang: "ini", group: "Обвязка", note: "зависимости PyPI" },
  { path: "pyproject.toml", lang: "ini", group: "Обвязка", note: "pip install -e . + скрипт bass2tabs" },
];

const GROUPS = ["Пакет", "Ядро", "Экспорт", "Обвязка"] as const;

function FileIcon({ lang }: { lang: ProjectFile["lang"] }) {
  const color = lang === "python" ? "#43c9a2" : lang === "markdown" ? "#f2a33c" : "#c0b096";
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1.5h5.5L13 5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 1.5V5H13" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
const assetUrl = (p: string) => `${base}/bass2tabs/${p}`;

export function CodeBrowser() {
  const [activePath, setActivePath] = useState(FILE_MANIFEST[6].path); // notes.py — гистерезис
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);

  const active = FILE_MANIFEST.find((f) => f.path === activePath) ?? FILE_MANIFEST[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(assetUrl(activePath))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => {
        if (!cancelled) {
          setCode(t);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCode(`# Не удалось загрузить ${activePath}.\n# Файлы лежат в public/bass2tabs/ и отдаются статикой.`);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ group: g, files: FILE_MANIFEST.filter((f) => f.group === g) })),
    []
  );

  return (
    <section id="code" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            kicker="03 · Исходники"
            title="Настоящие .py-файлы — читаются и скачиваются напрямую"
            lead="Код живёт в public/bass2tabs/ репозитория и отдаётся статикой без JS-рендера. Браузер ниже подтягивает те же файлы, что вы скачиваете, — единый источник правды. Соберите структуру bass2tabs/bass2tabs/… и запустите pip install -e ."
          />
        </div>

        <Reveal delay={100} className="mt-12">
          <div className="overflow-hidden rounded-xl border border-line bg-ink-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
            {/* mobile chips */}
            <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2.5 md:hidden">
              {FILE_MANIFEST.map((f) => (
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

            <div className="grid md:grid-cols-[260px_1fr]">
              <aside className="hidden border-r border-line bg-panel/60 px-3 py-4 md:block">
                <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                  bass2tabs/ · 14 файлов
                </p>
                {grouped.map(({ group, files }) => (
                  <div key={group} className="mb-4">
                    <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint/80">
                      {group}
                    </p>
                    <ul className="space-y-0.5">
                      {files.map((f) => {
                        const isActive = f.path === activePath;
                        return (
                          <li key={f.path}>
                            <button
                              type="button"
                              onClick={() => setActivePath(f.path)}
                              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-left font-mono text-[11.5px] ${
                                isActive
                                  ? "border-amber bg-amber/10 text-amber"
                                  : "border-transparent text-dim hover:bg-panel-2 hover:text-paper"
                              }`}
                              title={f.note}
                            >
                              <FileIcon lang={f.lang} />
                              <span className="truncate">{f.path.split("/").pop()}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </aside>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel/40 px-4 py-3">
                  <FileIcon lang={active.lang} />
                  <span className="font-mono text-[12.5px] font-medium text-paper">{active.path}</span>
                  <span className="hidden font-mono text-[11px] text-faint sm:inline">· {active.note}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <a
                      href={assetUrl(active.path)}
                      download
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[11px] font-medium text-dim transition-colors hover:border-phos/50 hover:text-phos"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Скачать
                    </a>
                    <CopyButton text={code} compact />
                  </div>
                </div>
                <div className="code-scroll max-h-[600px] overflow-auto bg-[#10161b]">
                  {loading ? (
                    <p className="px-5 py-5 font-mono text-[12px] text-faint">загрузка {active.path}…</p>
                  ) : (
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
                      {code}
                    </SyntaxHighlighter>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel/40 px-4 py-2.5">
                  <span className="font-mono text-[10.5px] text-faint">
                    {code ? `${code.split("\n").length} строк` : "…"} · python 3.11+ · utf-8
                  </span>
                  <a href={`${base}/bass2tabs/`} className="font-mono text-[10.5px] text-faint underline-offset-2 hover:text-amber hover:underline">
                    весь каталог — статикой
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
