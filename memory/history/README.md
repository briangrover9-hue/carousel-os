# History

`node scripts/rotate-log.js` moves old log entries here, one file per ISO week, named for the week (year, a `W`, then two digits). `node scripts/lessons.js expire` writes `expired-lessons.md` here. Nothing in this folder is loaded at session start. Search it when you need to know what happened.
