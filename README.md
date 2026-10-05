# MONTAJ — Reels для риелтора на Remotion

Система производства Instagram Reels: идея → сценарий (узбекский / русский) → видео → монтаж с анимациями → готовый mp4 с громкостью −14 LUFS и обложкой.
Правила и порядок работы — в скилле `.claude/skills/montaj-reels/` (кодовое слово для Claude: **рилсым**). Журнал — `PROGRESS.md`.

## Быстрый старт (Windows, PowerShell)

```powershell
cd C:\Users\user\MONTAJ
npm i
npm approve-scripts esbuild   # если npm попросит разрешить установочный скрипт
npm run dev                   # Remotion Studio: Reel и демо-ролики
```

## Ролик от начала до конца

```powershell
npm run ingest -- "C:\путь\к\video.mp4" kvartira-yunusobod      # приём видео (или mp3 → формат voice)
npm run transcribe -- reels/kvartira-yunusobod.mp4 uz           # субтитры (uz или ru); первый раз качает модель ~1,6 ГБ
npm run align -- reels/kvartira-yunusobod                       # точный текст из reels/<slug>/script.md
npm run new-reel -- kvartira-yunusobod full uz                  # заготовка плана reels/<slug>/edit.json
npm run check -- kvartira-yunusobod 2s 8s 15s                   # проверочные кадры → out/
npm run build-reel -- kvartira-yunusobod                        # → out/<slug>.mp4 и out/<slug>-cover.jpg
```

Обычно всё это делает Claude по скиллу — достаточно написать «рилсым <идея>» или прислать видео.

## Что внутри

| Путь | Что |
|---|---|
| `src/Reel/` | движок: композиция `Reel`, форматы full / split / voice, субтитры, камера, переходы, звук |
| `src/Reel/fx/` | 20 элементов: заголовки, карточка объекта, локация, «металлическая» цифра, объявление-герой, чек-лист и др. |
| `src/Reel/theme.ts` | палитры `sky`, `champagne`, `sage`, `blush` — сравнение в `docs/palettes.png` |
| `scripts/` | команды конвейера (`npm run …`) |
| `.claude/agents/` | агенты: сценарист и монтажёр |
| `.claude/skills/montaj-reels/` | скилл; справочники собирает `npm run pack-skill` |
| `reels/<slug>/` | сценарий и план каждого ролика (в git); видео — в `public/reels/` (не в git) |

Remotion бесплатен для команд до 3 человек — [лицензия](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
