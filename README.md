# AIHub DJ

The DJ console from **AIHub Browser**, as its own Windows app: two decks, local
music and YouTube, stems, effects, loops, cover-flow, ten console designs, and
the AI DJ stage.

## Where the code comes from

| Folder | Source |
|---|---|
| `src/renderer/src/components/dj/` | copied unchanged from AIHub Browser |
| `src/main/dj/`, `src/main/youtubeSearch.ts` | copied unchanged from AIHub Browser |
| `src/main/index.ts`, `net.ts`, `ai.ts`, `factsStore.ts`, `src/preload/index.ts` | the standalone shell around it |

AIHub Browser keeps its own copy of the DJ — this folder does not replace it.
To bring later DJ changes across, copy those two folders again from the browser.

## AI DJ

The AI DJ uses local **Ollama** (`http://localhost:11434`, small models such as
`llama3.2:3b` preferred). An OpenRouter key can be saved as a fallback through
`window.electronAPI.ai.settings.set({ openRouterKey })`; it is stored encrypted
with the Windows keychain (safeStorage), never in plain text.

## Commands

```bash
npm install        # also fetches the Electron binary
npm run dev        # run from source
npm test           # the DJ's tests
npm run icon       # re-render build/icon.ico from build/icon.svg (npx electron scripts/make-icon.cjs)
npm run package    # build dist/AIHub-DJ-Setup.exe
```

## Updates and releases

Version 1.1.0 adds GitHub update notifications, on-demand downloads and restart-to-update. Users on the original 1.0.0 installer must install 1.1.0 once. See [release instructions](docs/RELEASING.md) for packaging, validation and future tagged releases.
