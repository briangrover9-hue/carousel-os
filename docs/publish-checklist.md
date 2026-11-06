# Publish checklist

Run these steps before the repository goes public. This file is a maintainer note and is not part of the installed process.

## What ships

The repository ships the process and a blueprint for building your own engine. It does not ship an engine. The author's engine lives in a separate private folder, and the images in `docs/gallery/` are the only trace of it here.

## Before the first push

- Run `npm run check` on the full tree. It ends with "check: 6 of 6 steps passed".
- Run the leak scan with your own token list: `node scripts/leak-scan.js --tokens path/to/names.txt`. Keep the list outside the repository.
- Check `LICENSE`. It must hold one copyright line with the holder you intend.
- Search the tree for personal paths, email addresses and employer or client names. The leak scan covers paths and addresses. Names need your list.
- Read `git log` and `git config user.email` in the repository. The commits must carry the identity you want public.
- Run `npm pack --dry-run` and read the file list. Nothing in it should surprise you.
- CI runs `npm run check` on ubuntu, macos and windows with Node 20 and 22. Read all six jobs before you tag a release.
- Look at `docs/hero.png` and the eight images in `docs/gallery/`. Each must be under 300 KB and show only placeholder data.

## Repository settings

- Description: "An operating system for building presentations with an AI agent." (one line).
- Topics: `presentations`, `powerpoint`, `pptx`, `slides`, `deck`, `ai-agents`, `agent-skills`, `claude-code`, `workflow`.
- Enable issues. Turn off the wiki.

## First release

- Tag `v1.0.0` on the commit you publish.
- Write release notes from `memory/LOG.md` and the changes in the README.
- After publishing to npm (if you do), confirm `npx carousel-os doctor` runs in an empty folder.
