# Contributing

Thanks for helping with the Hacettepe AI client. This is a small React app, so a good first change is usually a few dozen lines.

## Pick something to work on

Issues labelled `good first issue` are the place to start. Comment on one to say you want it, and wait until it is assigned to you. For anything bigger than a small fix, open a draft PR early so the approach can be discussed before you polish it.

## Set up

You need Node 22.18 or newer. The check scripts import `.ts` files directly, and older Node versions fail with `ERR_UNKNOWN_FILE_EXTENSION`.

```bash
npm ci
npm run dev
```

The app talks to the backend through `/chat` and `/feedback`. Most UI work does not need the backend, but a real answer does. `CLAUDE.md` explains how to run it alongside (see Dev Commands).

## Before you open a PR

Branch from `dev` and open the PR against `dev`. `main` only receives releases.

Run the same commands CI runs:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run check:smoothing
npm run check:citations
npm run check:example-questions
```

The checks cover code, not the screen, so a clean build can still render wrong. If your change affects what users see, open it in the browser and say what you looked at. Screenshots help.

The first time you open a PR, GitHub holds the CI run until a maintainer approves it.

## Keep the diff to your change

- **Formatting.** Prettier owns layout (`npm run format`). Run it before committing, or point your editor at the project's Prettier. Do not reformat files you are not otherwise changing, and do not let an editor's own formatter rewrite a file.
- **Comments.** Leave existing comments in place. They explain why the code looks the way it does, and several guard against bugs that are easy to reintroduce. Delete one only if your change makes it wrong.
- **Check your diff.** `git diff origin/dev --stat` should list only the files and roughly the number of lines you meant to change.

## Code notes

- React 18 and TypeScript in strict mode. Tailwind CSS v4 (the theme lives in `src/index.css`) and shadcn/ui.
- Generated shadcn components live in `src/components/ui/`. Add one with `npx shadcn@latest add <name>`. On React 18 a component that Radix attaches a ref to needs `React.forwardRef`, see `docs/components.md`.
- Example questions on the empty screen are in `src/exampleQuestions.ts`. Send any new question to the deployed site first and read `docs/example-questions.md`.

## The pull request

Fill in the sections of the PR template: what changed, why, how you verified it, and what is not included. Say what you did not test. PRs are squash-merged, so write the title as a [Conventional Commit](https://www.conventionalcommits.org/), such as `fix: show the error text in Turkish`.

`CLAUDE.md` is the project's context file. It is written for a coding assistant, but it is also the fullest description of how the app is put together, and `docs/` has the longer notes.
