---
title: Website Revamp in Progress — How Content Publishing Works
description: The new site manages content as Markdown — publishing means opening a PR, and merging means going live.
pubDate: 2026-07-20
lang: en
author: DDD Taiwan
tags: [announcement]
---

The DDD Taiwan website revamp is underway. Here is the new content publishing workflow:

1. Add a Markdown file under `src/content/posts/` (fill in `title`, `description`, and `pubDate` in the frontmatter).
2. Open a Pull Request for community members to review.
3. Once merged to `main`, GitHub Actions automatically builds and deploys the site to ddd-tw.com.

For republished Papers articles, please also add `source` (a link to the original) and `authorization` (a record of the author's permission) to the frontmatter, so they can be verified during review.
