---
title: Plain text outlives software
date: 2026-05-19
updated: 2026-08-05T11:10:00.000Z
tags:
  - programming/architecture
  - meta
favorite: false
---

Every note-taking application I have lost data to had a database. Not because
databases are bad, but because the data was only reachable through the one
program that understood the schema, and that program stopped being maintained.

A file on disk has a different failure mode. The worst case is that you open it
in a text editor and read it.

## What this costs

Choosing files means giving up the things a query engine gives you cheaply:

```ts
// There is no index to ask, so the whole notebook is read and derived.
const collection = new NoteCollection(
  files.map((file) => buildNote(file, contentDirectory)),
);
```

For a few thousand notes this takes milliseconds and the answer is always
current. The trade only goes bad at a scale a person cannot read anyway.

> [!warning] The honest limit
> This approach stops being sensible somewhere in the tens of thousands of
> notes. That is a fine place for it to stop.

## Where it connects

The same instinct shows up in [[Stoicism]]: prefer the thing you can actually
control. A file is controllable. A hosted schema is not.
