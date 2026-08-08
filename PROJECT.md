# PROJECT.md

The working record of how Commonleaf is built and why. `README.md` is written for
people who want to _use_ the application; this file is for people who want to
_change_ it — including future maintainers who were not around for the original
decisions.

Keep it current. Every milestone updates the status table and adds any decision
that a newcomer would otherwise have to reverse-engineer.

**Last updated:** end of Milestone 7.

---

## 1. What this is

A commonplace book: a personal collection of ideas, quotes, reading notes,
journal entries and research, kept as plain Markdown files.

Three constraints shape everything else:

1. **No database.** Not SQL, not NoSQL, not a hosted backend. Every note is a
   `.md` file with a YAML frontmatter block.
2. **Git is the storage layer.** Saving a note is a commit. Version history is
   `git log`. We never reimplement what Git already does well.
3. **The data outlives the application.** If this project is abandoned tomorrow,
   the user still has a folder of Markdown files they can open in any editor.
   That is the point, not a fallback.

### Non-goals

Real-time collaboration, AI writing tools, cloud sync, user accounts,
multi-user support, advertising, analytics, telemetry, tracking, notifications.
These are not "later" — they are deliberately out of scope, because each one
would compromise one of the three constraints above.

---

## 2. Architecture

```
                    ┌──────────────────────────────┐
   Server Components│  app/  — routes and pages    │
   and Route        │  components/ — presentation  │
   Handlers         └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
   Domain           │  lib/notes/  — the note model│
   (no I/O)         │  lib/theme/, lib/settings/   │
                    └──────────────┬───────────────┘
                                   │  Storage port
                    ┌──────────────▼───────────────┐
   Adapters         │  lib/storage/github.ts       │
                    │  lib/storage/filesystem.ts   │
                    └──────────────────────────────┘
```

The rule that keeps this honest: **nothing above `lib/storage/` may know that
GitHub exists.** The application talks to the `Storage` interface in
`lib/storage/types.ts` and nothing else. Adding GitLab or Forgejo means writing
one file and registering it in `lib/storage/index.ts`.

### The Storage port

```ts
interface Storage {
  revision(): Promise<string>;
  readTree(prefix: string): Promise<TextFile[]>;
  read(path: string): Promise<TextFile | null>;
  readBinary(path: string): Promise<BinaryFile | null>;
  commit(message: string, changes: readonly Change[]): Promise<CommitResult>;
  history(path: string, limit: number): Promise<Revision[]>;
  readAtRevision(path: string, revision: string): Promise<string | null>;
}
```

It is deliberately file-shaped rather than note-shaped. A `saveNote(note)` method
would push Markdown serialisation down into every adapter, and each new backend
would have to reimplement it — and would eventually get it subtly wrong. Keeping
the port at the level of bytes and paths means the note model is written once,
in `lib/notes/`, and every adapter inherits it.

`commit()` takes a _list_ of changes for the same reason: a rename, or a note
plus the image pasted into it, should land as one revision rather than three.

### Drivers

| Driver       | When it is used                                         | Notes                                                                                              |
| ------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `github`     | Default. Vercel and most self-hosting.                  | REST API, server-side token only.                                                                  |
| `filesystem` | Local development, tests, Docker with a mounted volume. | Commits via the `git` CLI when the directory is a working tree; still writes files when it is not. |

---

## 3. Decisions worth knowing

Each of these cost more than five minutes to reach; they are recorded so nobody
has to relitigate them from scratch.

**Bulk reads use the GitHub tarball endpoint.** Building the note index needs
every Markdown file. Fetching them as blobs is one request per file — hundreds of
round trips and a rate limit you will actually hit. One archive download is a
single request. The cost is a ~120-line tar reader (`lib/storage/tar.ts`), which
is a good trade for a format that has not changed since 1988.

**Writes use the Git Data API, not the Contents API.** The Contents API is
simpler but writes one file per commit. Building the tree by hand costs a few
more requests and buys atomic multi-file changes and a readable history.

**Blob SHAs are computed locally.** `gitBlobSha()` reproduces Git's
`blob <len>\0<bytes>` hash, so a SHA from a bulk archive read and a SHA reported
by GitHub are interchangeable. That is what makes optimistic concurrency —
refusing to overwrite a note that changed underneath you — trustworthy rather
than approximate.

**Themes are data, not CSS.** `lib/theme/themes.ts` holds ten complete palettes;
`lib/theme/css.ts` generates the stylesheet from them. Hand-writing both would
mean the settings screen and the stylesheet could disagree, and eventually they
would.

**Reader settings live in `localStorage`, not the repository.** Changing the line
height should not produce a commit, and a phone and a desktop should be able to
differ. The `/settings` directory in the vault is reserved for anything that is
genuinely content.

**The no-flash bootstrap script shares its code with the React provider.**
`applySettings()` is stringified into an inline `<script>` via `.toString()`. It
must therefore stay free of runtime imports and of syntax that a compiler might
rewrite into an out-of-scope helper — hence `Object.assign` instead of object
spread in `lib/settings/bootstrap.ts`. This is unusual enough to be worth the
comment it carries.

**The filesystem driver hashes contents for its revision token, not mtimes.**
Timestamp resolution is coarse enough that two edits in the same tick can share
one, and a revision token that fails to change would serve stale notes forever.

**ESLint is pinned to 9.x.** `eslint-plugin-react`, vendored by
`eslint-config-next@16`, uses a context API that ESLint 10 removed. Revisit when
that dependency catches up.

**Frontmatter is parsed with YAML's core schema, not YAML 1.1.** The default
schema turns `date: 2026-01-04` into a JavaScript `Date`, which comes back out
as `2026-01-04T00:00:00.000Z` — silently rewriting the reader's file with a
timezone they never chose. The core schema leaves scalars as strings, so what
is in the file is what we read and write. This is why `js-yaml` is a direct
dependency rather than only a transitive one.

**The slug is derived from the file path, never stored.** Moving a file in any
editor moves the note, and there is nothing to keep in sync. It also means the
only identifier is one a person can read.

**Wiki links resolve by slug, then title, then file name, then alias.** Each
candidate carries a strength, so a note's own slug beats another note's alias
regardless of indexing order. Without the ranking, resolution would silently
depend on which note was edited most recently.

**A link to a note that does not exist is a normal state.** It renders with a
dashed underline and still has a URL — the slug the note _would_ have — so
following it can offer to create it. `NoteCollection.unresolvedTargets` exposes
the whole set, because a notebook's open questions are worth surfacing.

**Markdown renders on the server.** `react-markdown`'s default export is
synchronous and hook-free, so `NoteMarkdown` works as a Server Component:
reading a note ships HTML and no parser. The same component runs on the client
for the editor's preview, which is why it must stay free of server-only
imports.

**Raw HTML is not enabled in the renderer.** These are the reader's own files,
but a Markdown renderer that executes whatever gets pasted into it is a poor
default, and nothing in a commonplace book needs it.

**Images are served through `/api/media`, never linked directly.** The
repository is private, so the token that can read it must not leave the server.
The route allowlists file extensions rather than sniffing types, and sends a
restrictive `Content-Security-Policy` so a stored SVG cannot become a script.

**Attachments live in one folder, not beside the note.** Notes get moved and
renamed constantly; an attachment that has to follow them around is a source of
broken links.

**Reading and writing are separate routes.** `/notes/<slug>` is a Server
Component that ships no JavaScript; `/edit/<slug>` loads the editor. Folding
the editor into the reading view would send CodeMirror to everyone who only
wanted to read. Because the editor renders Markdown live the two look nearly
identical, so the seam is invisible in use and worth a great deal in what
reading costs. (Editing lives under its own prefix because Next.js does not
allow routes nested inside a catch-all segment.)

**The document lives in CodeMirror, not in React state.** Mirroring it into
React and writing back on every keystroke is the usual way this integration
goes wrong, and it costs a re-render per character. The view is created once;
React holds only what surrounds the text. Callbacks are passed through a ref so
that a parent re-render never rebuilds the extension list and destroys the undo
history.

**Live preview hides syntax per _line_, not per element.** A cursor three words
away should not make asterisks reappear, and "the line I am on" is something a
person can predict without thinking about it.

**Wiki links and hashtags are taught to the Markdown grammar.** Both could be
found with a regular expression, but adding them to the parser means they
inherit what it already knows: neither is recognised inside a code span or a
fenced block, and both nest correctly inside emphasis and lists. That
correctness is free here and would have to be rebuilt by hand otherwise.

**`basicSetup` is not used.** It brings line numbers, a fold gutter, bracket
matching and an active-line highlight — every one of which belongs in a code
editor and none of which belongs on a page of prose. The extensions are listed
individually so that what the editor does is visible rather than inherited.

**The editor uses the reading font, not the monospace one.** This is a
live-preview editor for prose: you are looking at the note, not at its source.
Monospace is reserved for code, where it earns its keep.

**The editor never shows the reader YAML.** It sends prose plus a title; the
save endpoint merges that into the frontmatter already on disk. This also means
a field added by a future version is not wiped out by an older client.

**Reader settings live outside React, behind `useSyncExternalStore`.**
`localStorage` and the document element are external systems, so the state
mirroring them does not belong in the component tree. There is no provider, no
cascade of renders at mount, and no hydration mismatch — React is told
explicitly that the server's snapshot is the defaults. Anything can read or
change a setting, including code that is not a component.

**Paste cleanup removes only what cannot be seen.** Non-breaking spaces,
zero-width characters, soft hyphens, stray carriage returns. It does not touch
punctuation, casing or Markdown: rewriting someone's prose on paste would be
worse than the problem it solved. Those character classes are written as
`\uXXXX` escapes, because a class of invisible characters is impossible to
review and easy to corrupt in an editor.

**Dates are formatted from a fixed table, not `Intl`.** `Intl` resolves month
names against the host locale, which differs between the server that renders a
page and the browser that hydrates it. A small table is deterministic. It is
also the obvious seam if the project is ever translated.

**One command, three ways to reach it.** The formatting toolbar, the `/` menu
and the keymap all invoke the same `StateCommand` from `lib/editor/commands.ts`.
That is why the commands were written as `StateCommand`s in the first place —
they are document transformations testable without a DOM, and adding a fourth
surface later costs nothing. A table that gained a column in the toolbar but not
in the slash menu is exactly the bug this prevents.

**The `/` and `[[` menus are CodeMirror's autocompletion, not a popup of our
own.** Filtering, keyboard handling, positioning and scroll-into-view all come
free, and there is one menu in the editor rather than two that behave almost the
same. The sources return `null` unless the cursor is somewhere they apply, which
is what makes `activateOnTyping` safe: typing prose never raises a menu.

**CodeMirror's own DOM is styled through CodeMirror's theme, not `styles/`.**
CodeMirror injects its rules unlayered, and unlayered CSS beats everything in
`@layer components` regardless of specificity. The completion menu is therefore
styled in `lib/editor/theme.ts`. This cost an afternoon once; the inverse of the
same rule is why `styles/` is layered at all.

**Importing writes the bytes it was given.** It would be easy to re-serialise
every incoming note into this application's canonical form, and it would be
wrong: importing somebody's vault is not an invitation to reformat it. A file
only changes when its author next saves it. Archive paths are normalised and
anything that climbs, is absolute, or hides in a dot directory is dropped — a
ZIP is untrusted input.

**Destructive actions live on the thing they destroy.** Delete and move are on
the note and nowhere else. A palette is somewhere you arrive by fuzzy match, and
"Delete this note" one keystroke from "Daily note" is a trap.

**A note gets named in one place.** Creating a note needs a title, and the
palette already takes a title and turns it into a note. **New note** in the bar
therefore opens the palette in `create` mode rather than doing the work itself:
two ways in, one implementation, and no second dialog to keep in step. The mode
is the same palette with the order reversed — writing first, matching notes
underneath, so a note you have already written is hard to write twice. The new
note is filed in the folder the URL is standing in, which is what
`folderFromPathname` is for.

For a while there was no way in at all: creating a note was reachable only by
typing a title into search, following an unwritten link, or the daily button,
and the empty library said "press ⌘K" where a button belonged. Every path
existed and none of them was visible.

**Notes in a folder read in file order, and nothing records that order.** The
alternatives were a `pages:` list in a `_book.md`, an `order:` number in
frontmatter, or filename prefixes. File order needs none of them: a vault from
Obsidian or a Jekyll `_posts` directory already has an order, renaming a file is
how you change it, and there is no metadata that can fall out of step with the
files. A subfolder is its own sequence rather than a continuation of its parent,
which is the difference between a chapter and the next paragraph.

This is deliberately the small version of "make it feel like a book". A shelf of
books with covers, an explicit contents list and drag-to-reorder are all
possible on top of it later; none of them is needed for the page turn, which is
what the feeling actually rests on.

---

## 4. Folder layout

```
app/          Routes, layouts, route handlers. Server Components by default.
  (notebook)/     Everything inside the shell. A route group, so no URL changes.
components/   Presentational React. No data fetching, no storage imports.
hooks/        Reusable client-side behaviour.
lib/          The domain. Pure TypeScript, no JSX.
  api/            HTTP error mapping, and the browser's typed client.
  branding.ts     Product name and strings — the only place they appear.
  commands/       The command registry and its ranking. No React.
  config.ts       Environment reading. Server-only.
  editor/         CodeMirror extensions, commands and appearance.
  keyboard.ts     Shortcut matching, and the Ctrl/Command difference.
  markdown/       Remark plugins and asset resolution.
  notes/          The note model and everything derived from it.
  palette/        Whether the palette is open. An external store.
  search/         Search documents, the Fuse wrapper, the browser-side cache.
  settings/       Reader preferences, the store, and the pre-paint bootstrap.
  storage/        The port and its drivers.
  theme/          Palettes, fonts, generated CSS.
  vault/          Export and import of the whole notebook as an archive.
styles/       Paper surfaces, reading typography, shell and palette.
content/      A sample vault. Also what the filesystem driver reads in dev.
docs/images/  README screenshots, generated by `npm run screenshots`.
tests/        Vitest. Mirrors lib/ and components/.
docker/       Dockerfile and compose file.
docs/         Longer-form documentation.
scripts/      Maintenance scripts. `screenshots.mjs` regenerates the README's.
```

### Inside `lib/notes/`

Split along one line: **pure** modules can be imported anywhere and are trivial
to test; **server-only** modules touch storage. Only two are server-only.

| Module             | Role                                                         |
| ------------------ | ------------------------------------------------------------ |
| `frontmatter.ts`   | Parse forgivingly, serialise canonically.                    |
| `paths.ts`         | Path ↔ slug ↔ title. Traversal defences.                     |
| `markdown-text.ts` | Code stripping, excerpts, word counts.                       |
| `wikilinks.ts`     | Extract and normalise `[[links]]`.                           |
| `tags.ts`          | Inline tags and the nested tag tree.                         |
| `dates.ts`         | Deterministic parsing and formatting.                        |
| `daily.ts`         | Daily-note naming and navigation.                            |
| `note.ts`          | One file → one `Note`.                                       |
| `collection.ts`    | The whole notebook, indexed. Pure.                           |
| `links.ts`         | Route builders, the wiki-link resolver, slug-from-URL.       |
| `load.ts`          | `loadNotes()` — reads the notebook without throwing.         |
| `store.ts`         | **Server-only.** Reads storage, caches by revision.          |
| `repository.ts`    | **Server-only.** Every write, one commit each. Plus history. |

---

## 5. Conventions

- **Strict TypeScript.** `any` is an ESLint error. Prefer a narrower type or
  `unknown` with a parse step.
- **Comments explain _why_.** A comment restating the code is noise. A comment
  explaining a trade-off, a workaround or a non-obvious constraint is the most
  valuable thing in the file.
- **Server-only modules import `server-only`.** An accidental client import then
  fails at build time rather than leaking a token at runtime.
- **Parsing is forgiving, writing is canonical.** Hand-edited notes must always
  open. Files this app writes are byte-stable, so saving twice produces no diff.
- **No component library.** Components are small and local. If two of them want
  the same thing, extract it; do not reach for a framework.
- **Component CSS lives in `@layer components`.** Tailwind puts its utilities in
  `@layer utilities`, and unlayered CSS beats every layer. A `.shell-action`
  outside a layer therefore silently overrides `lg:hidden` — which it did, until
  it was caught. Every file in `styles/` is wrapped.
- **Shared state that is not React's lives outside React.** Settings and the
  palette are external stores read through `useSyncExternalStore`. That is what
  lets a keyboard handler, a button and a Server Component boundary all touch
  the same state without a provider, and it keeps the server snapshot explicit
  so hydration cannot mismatch.
- **Branding goes through `lib/branding.ts`.** Renaming the project should be a
  one-file change.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).

---

## 6. Status

| #   | Milestone                       | Status       |
| --- | ------------------------------- | ------------ |
| 1   | Project foundation              | **Complete** |
| 2   | Git storage layer               | **Complete** |
| 3   | Markdown engine                 | **Complete** |
| 4   | Editor                          | **Complete** |
| 5   | Interface                       | **Complete** |
| 6   | Polish                          | **Complete** |
| 7   | Writing and reading in sequence | **Complete** |

### Complete

**Milestone 1 — Foundation.** Next.js 16 (App Router) with strict TypeScript;
Tailwind v4; ESLint, Prettier, Husky and lint-staged; Vitest with a GitHub API
mock; a multi-stage Dockerfile with healthcheck plus a compose file; GitHub
Actions running lint, typecheck, test, build and a Docker build; ten paper
themes with generated CSS; eleven self-hosted font families, three preloaded;
paper grain and laid lines; deckled edges, binding and ribbon; reading
typography; the pre-paint settings bootstrap; a health endpoint.

**Milestone 2 — Storage.** The `Storage` port; the GitHub driver (tarball bulk
reads, Git Data API commits, history, read-at-revision); the filesystem driver
(including `git log` history when the vault is a working tree); optimistic
concurrency with a shared conflict check; binary read and write for images;
actionable error messages for bad tokens, rate limits, missing branches and
empty repositories; 62 tests.

**Milestone 3 — Markdown engine.** Forgiving frontmatter parsing and canonical
serialisation; the note model; slug and path handling with traversal defences;
`NoteCollection` deriving lookup, backlinks with quoted context, nested tags,
folders and favourites in one pass; a revision-keyed index cache; the write
repository (create, save, move, delete, `ensureNote`, `ensureDailyNote`,
`saveImage`), each producing one readable commit; daily notes; remark plugins
for wiki links and callouts; the `NoteMarkdown` Server Component; the media
route; a sample vault under `content/`; a read-only note view and a library
index. 182 tests.

**Milestone 4 — Editor.** The HTTP surface (`/api/notes`, `/api/notes/[...slug]`
for read, save, move and delete, `/api/wikilinks`, `/api/daily`, `/api/images`)
with one place that turns domain errors into responses; a typed client that
gives the browser `RequestError` with the server's code intact. CodeMirror 6
assembled by hand: live-preview decorations, wiki links and hashtags added to
the grammar, list and blockquote continuation, formatting commands, paste
cleanup, image paste and drop with an optimistic placeholder. Autosave with a
debounce from settings, a save indicator, and conflict detection surfaced as a
choice rather than a silent overwrite. Split view, zen mode, focus mode. Reader
settings moved to an external store. 234 tests.

**Milestone 5 — Interface.** The shell: a route group `app/(notebook)/` whose
layout renders the index once per navigation as a Server Component, so folders
and tags cost no JavaScript. The index is a saved preference on a wide screen
and a drawer on a narrow one — deliberately different mechanisms, because one
should persist and the other should not. The command palette (`Ctrl/⌘ K` for
notes, `Ctrl/⌘ ⇧ P` for actions, `/` for a quick search) loads Fuse.js and the
index on first open and never on first paint; the index is dropped whenever a
write goes through the API client, so a note created in the palette is findable
in it a moment later. Pages for tags, folders, favourites, unwritten links and
settings, all sharing one `NoteList` and one `Page`. Version history read
straight from the Git log, with a restore that writes a new commit rather than
rewinding. Following a wiki link to an unwritten note now offers to write it.
273 tests.

**Milestone 6 — Polish, and an editor for people who do not write Markdown.**

The editor gained the half it was missing. It already _hid_ the syntax while you
read; now it can _produce_ it without you knowing any: a formatting toolbar
(off-switch in settings), a `/` menu of blocks named in plain English, `[[`
completion over every existing note, an image picker beside the paste handler,
and a one-card syntax reference. The toolbar, the slash menu and the keymap all
run the same `StateCommand`s, so they cannot drift; the two menus are built on
CodeMirror's own autocompletion rather than a hand-rolled popup, so the keyboard
behaviour stays the library's problem.

Import and export: a `.zip` of the vault exactly as stored, a JSON view for
feeding elsewhere, and an importer that accepts any folder of Markdown — an
Obsidian vault, a Jekyll `_posts`, an archive from here — writing the bytes
untouched in one commit. Move, rename and delete now exist on the note itself.
An accessibility pass fixed the heading outline, two unlabelled file inputs and
the missing `h1` on the editor. A `README.md` with setup, Vercel and Docker
instructions, illustrated by `npm run screenshots` — a Playwright script that
drives a headless browser through four views. Writing it immediately earned its
keep: framing the editor shot exposed that callout markers (`> [!note]`) were
never hidden in live preview and sat in the prose looking like a typo, and that
the palette stretched to its own `max-height` whatever was in it. Both fixed.
300 tests.

**Milestone 7 — Writing and reading in sequence.** A **New note** button in the
bar, which was simply missing: every way of creating a note was a side door, and
the empty library named a keyboard shortcut instead of offering one. It opens
the palette in a third mode that leads with writing and files the note in the
folder currently on screen. And a page turn under every note — the previous and
next note in its folder, in file order, recorded nowhere. 308 tests.

### Measured, so the next person does not have to guess

Taken from a production build, gzipped, against the sample vault:

| Route          | JS shipped | Notes                                               |
| -------------- | ---------- | --------------------------------------------------- |
| Reading a note | **185 KB** | No CodeMirror, no Fuse                              |
| Editing a note | **457 KB** | CodeMirror included                                 |
| Fuse.js        | **26 KB**  | Its own chunk, fetched when the palette first opens |

The reading/writing split is therefore real and worth keeping: a reader pays
185 KB, not 457 KB.

### Known limitations

- The editor's title field renames what the note calls itself, not the file.
  Moving the file is a separate, deliberate action on the note — which is the
  honest split, since most people mean the former.
- **Code blocks are not syntax highlighted, and that is now a decision rather
  than a deferral.** The reading view is a Server Component, so highlighting
  there would cost the reader nothing — but `NoteMarkdown` is also what renders
  the editor's preview pane, so a highlighter would ship to the browser on the
  edit route, which already carries 457 KB. Meanwhile CodeMirror already
  highlights code _in_ the editor, and code is incidental in a commonplace book.
  Revisit only if the renderer is ever split into a server-only and a client
  variant; until then the cost lands in the wrong place.
- The screenshots in the README are generated, not hand-taken — `npm run
screenshots` drives a headless Chromium through four views. They will drift
  from the interface unless someone re-runs it after a visible change; nothing
  enforces that, and a CI check that diffs images would be more trouble than it
  is worth for a personal notebook.
- A folder's reading order is its file order, so controlling it means naming
  files `01-…`, `02-…`, which shows up in no interface but the file browser.
  That is the price of storing no ordering metadata, and worth paying until
  somebody actually wants to reorder a long folder by hand.
- The note index caches per server instance. On Vercel that means one cache per
  serverless instance — correct, but a cold instance rebuilds. Acceptable for a
  personal notebook; revisit only if it proves slow in practice.
- The GitHub driver assumes a non-empty repository, because a branch must exist
  before it can be committed to. The error message says so.
- `next/font` fetches from Google Fonts at build time, so an offline Docker
  build will fail. Documented rather than worked around.
- Version history needs a driver that can read a log. The GitHub driver always
  can; the filesystem driver can only when the vault is inside a Git working
  tree, and the page says so plainly instead of pretending the note has no past.
- Deleting and moving live on the note itself and nowhere else. The palette
  deliberately does not offer them — a destructive action one fuzzy match away
  from "daily" is a trap.
- **Neither export nor import carries pictures.** `Storage.readTree()` returns
  Markdown only — both drivers filter on `.md` — so the export archive contains
  notes and nothing else, and import skips non-Markdown entries rather than
  writing them through a text path that would corrupt them. Pictures still
  paste, upload and serve normally; they are simply not in the archive. The fix
  is a `list(prefix)` on the port returning every entry, so the archive builder
  can `readBinary()` the rest — a considered port change rather than something
  to bolt on. Until then the button says "all notes", not "everything".
- The whole search index is sent to the browser in one response. That is the
  right trade for a personal notebook and stops being so somewhere in the low
  tens of thousands of notes, at which point ranking moves to the server.

---

## 7. Extension points

Designed for, not yet built. Each should be addable without restructuring:

- **More storage backends** — implement `Storage`, register in
  `lib/storage/index.ts`.
- **Plugins** — the Markdown pipeline in `lib/notes/` is assembled from remark
  and rehype plugins; a registry is the natural seam.
- **Math** — `remark-math` plus a KaTeX stylesheet drops into that same
  pipeline. Deliberately deferred so the CSS budget stays honest.
- **Semantic search** — `lib/search/searcher.ts` exposes a `Searcher` interface
  with one method; an embedding index can sit behind it without the palette
  noticing.
- **More commands** — `buildCommands` takes a context and returns data. A plugin
  contributing entries is a concatenation, not a refactor.
- **Static publishing** — the note index plus the renderer is already most of a
  static site generator.
