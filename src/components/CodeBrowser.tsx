import { useEffect, useState } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton, Reveal, SectionHeading } from "../ui";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("ini", ini);
SyntaxHighlighter.registerLanguage("toml", toml);

type SrcFile = {
  rel: string; // путь относительно public/bass2tabs/
  lang: "python" | "markdown" | "ini" | "toml";
  group: string;
  note: string;
};

export const SRC_FILES: SrcFile[] = [
  { rel: "README.md", lang: "markdown", group: "Обвязка", note: "установка, флаги CLI, диагностика" },
  { rel: "requirements.txt", lang: "ini", group: "Обвязка", note: "torch / torchcrepe / librosa / mido / PyGuitarPro" },
  { rel: "pyproject.toml", lang: "toml", group: "Обвязка", note: "устанавливаемый пакет: pip install -e ." },
  { rel: "bass2tabs/__init__.py", lang: "python", group: "Ядро", note: "версия пакета" },
  { rel: "bass2tabs/__main__.py", lang: "python", group: "Ядро", note: "точка входа python -m bass2tabs" },
  { rel: "bass2tabs/cli.py", lang: "python", group: "Ядро", note: "аргументы, оркестрация, прогресс-бары, итоги" },
  { rel: "bass2tabs/mps.py", lang: "python", group: "Ядро", note: "выбор устройства MPS/CUDA/CPU, --check" },
  { rel: "bass2tabs/audio.py", lang: "python", group: "Ядро", note: "soundfile + ffmpeg, ресемплинг, highpass (CPU)" },
  { rel: "bass2tabs/pitch.py", lang: "python", group: "Ядро", note: "CREPE на MPS: чанки, Витерби, subprocess, откат на CPU" },
  { rel: "bass2tabs/notes.py", lang: "python", group: "Ядро", note: "онсеты → сегменты → ноты, темп, квантизация" },
  { rel: "bass2tabs/text.py", lang: "python", group: "Ядро", note: "транслитерация кириллицы в latin-1 для MIDI/GP" },
  { rel: "bass2tabs/export_midi.py", lang: "python", group: "Экспорт", note: "Standard MIDI File: 480 tpq, program 34" },
  { rel: "bass2tabs/export_xml.py", lang: "python", group: "Экспорт", note: "MusicXML partwise: басовый ключ, tie-связки (UTF-8)" },
  { rel: "bass2tabs/export_gp5.py", lang: "python", group: "Экспорт", note: "Guitar Pro 5: строй E–A–D–G, минимальные лады" },
];

const GROUP_ORDER = ["Ядро", "Экспорт", "Обвязка"];

const base = import.meta.env.BASE_URL;
const fileUrl = (rel: string) => `${base}bass2tabs/${rel}`;

function FileIcon({ lang }: { lang: SrcFile["lang"] }) {
  const color = lang === "python" ? "#43c9a2" : lang === "markdown" ? "#f2a33c" : "#c0b096";
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 1.5h5.5L13 5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.4" />
      <path d="M9.5 1.5V5H13" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function CodeBrowser() {
  const [active, setActive] = useState<SrcFile>(SRC_FILES[3]); // __init__.py
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(fileUrl(active.rel))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((txt) => {
        if (!cancelled) setContent(txt);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const grouped = GROUP_ORDER.map((g) => ({ group: g, files: SRC_FILES.filter((f) => f.group === g) }));
  const loc = content ? content.split("\n").length : 0;

  return (
    <section id="code" className="scroll-mt-24 border-t border-line py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            kicker="03 · Исходники"
            title="Настоящие .py-файлы — скачиваются напрямую"
            lead="Весь пакет лежит в репозитории как реальные файлы (public/bass2tabs/) и отдаётся статикой без какого-либо JS-рендера. Ниже — просмотр и прямые ссылки на скачивание каждого файла."
          />
          <Reveal delay={150}>
            <a
              href={fileUrl(active.rel)}
              download
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 font-mono text-[12px] font-medium text-dim transition-colors hover:border-phos/50 hover:text-phos"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Скачать текущий файл
            </a>
          </Reveal>
        </div>

        <Reveal delay={100} className="mt-12">
          <div className="overflow-hidden rounded-xl border border-line bg-ink-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
            {/* mobile chips */}
            <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2.5 md:hidden">
              {SRC_FILES.map((f) => (
                <button
                  key={f.rel}
                  type="button"
                  onClick={() => setActive(f)}
                  className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                    f.rel === active.rel ? "border-amber/60 bg-amber/10 text-amber" : "border-line text-dim"
                  }`}
                >
                  {f.rel.split("/").pop()}
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
                      {group === "Ядро" ? "ядро · dsp + mps" : group === "Экспорт" ? "экспорт форматов" : "обвязка · cli + docs"}
                    </p>
                    <ul className="space-y-0.5">
                      {files.map((f) => {
                        const isActive = f.rel === active.rel;
                        return (
                          <li key={f.rel}>
                            <button
                              type="button"
                              onClick={() => setActive(f)}
                              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-left font-mono text-[11.5px] ${
                                isActive
                                  ? "border-amber bg-amber/10 text-amber"
                                  : "border-transparent text-dim hover:bg-panel-2 hover:text-paper"
                              }`}
                              title={f.note}
                            >
                              <FileIcon lang={f.lang} />
                              <span className="truncate">{f.rel.split("/").pop()}</span>
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
                  <span className="font-mono text-[12.5px] font-medium text-paper">{active.rel}</span>
                  <span className="hidden font-mono text-[11px] text-faint sm:inline">· {active.note}</span>
                  <span className="ml-auto rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-faint">
                    {loc} строк
                  </span>
                  {content && <CopyButton text={content} compact />}
                  <a
                    href={fileUrl(active.rel)}
                    download
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 font-mono text-[11px] font-medium text-dim transition-colors hover:border-phos/50 hover:text-phos"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 2v8m0 0 3-3M8 10 5 7M3 13h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    .py
                  </a>
                </div>
                <div className="code-scroll max-h-[620px] overflow-auto bg-[#120e09]">
                  {loading && (
                    <p className="px-5 py-8 font-mono text-[12px] text-faint">чтение файла…</p>
                  )}
                  {!loading && error && (
                    <p className="px-5 py-8 font-mono text-[12px] text-alert">
                      не удалось прочитать файл — он доступен напрямую по ссылке «Скачать».
                    </p>
                  )}
                  {!loading && !error && content && (
                    <SyntaxHighlighter
                      language={active.lang}
                      style={vscDarkPlus}
                      showLineNumbers
                      lineNumberStyle={{ color: "#4a3f2e", fontSize: "11px", minWidth: "2.6em" }}
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
                      {content}
                    </SyntaxHighlighter>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel/40 px-4 py-2.5">
                  <span className="font-mono text-[10.5px] text-faint">
                    файлы лежат в public/bass2tabs/ и отдаются статикой — без JS-рендера
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
