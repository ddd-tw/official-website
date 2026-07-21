---
title: Understand the Problem First — Chaining Impact Mapping, Event Storming, and Continuous Architecture into One Combo
description: No single method solves complex problems. Starting from a true story of a client sold on "just move everything to Kubernetes," this piece walks through how Cynefin, Impact Mapping, Wardley Mapping, Event Storming, Specification by Example, and Rozanski & Woods viewpoints each play their part.
pubDate: 2026-07-21
lang: en
author: Kim Kao
tags: [methodology, event-storming, impact-mapping, continuous-architecture]
---

A few years ago I met a retail client whose previous vendor had already handed them the answer: "Move everything to Kubernetes and your problems go away." The real problem was a twenty-year-old system underneath that nobody fully understood anymore. **They knew the answer before they understood the problem.**

I didn't argue about Kubernetes with anyone. Instead I did two things: I used **Impact Mapping** to ask the decision-makers and functional leads, "Who would support the goal of month-over-month revenue growth? Whose behavior needs to change?" Then I ran a **two-day Event Storming workshop with forty to fifty people**, laying the entire business flow out on the wall. The answer surfaced on its own: the place truly worth starting from was merchant management — nothing to do with Kubernetes.

This article isn't about which method is best. It's about **how each one does its own job**:

## Each method answers one question

**Cynefin — what kind of situation are we in?**
Clear problems take best practices; complicated ones need expert analysis; complex ones can only be probed, sensed, and responded to. Picking tools before reading the situation is where most project disasters begin. Modernizing a twenty-year-old system almost always lands in the complex domain — which means you need methods of exploration, not ready-made answers.

**Impact Mapping — why are we doing this, and who can help?**
Goal → actors → impacts → deliverables. Its greatest value is flipping "we need to build feature X" into "whose behavior must change for the goal to be met." The question in the story above came straight from here.

**Wardley Mapping — where are these components on the evolution axis?**
Draw the value chain against evolution and you can see what to build, what to buy, and what is commoditizing. Technology selection stops being a matter of faith and becomes a strategic conversation with actual terrain.

**Event Storming — what actually happens in this domain?**
Put everyone who knows a piece of the business in one room and lay out domain events on orange stickies. The output is more than a process diagram — it's shared language, proto-bounded-contexts, and the collective realization of "so *that's* how your department understands this."

**Domain Storytelling — does this concrete case really flow that way?**
Event Storming gives you the panorama; Domain Storytelling verifies the details one concrete story at a time. They complement each other.

**Specification by Example — are the rules actually clear?**
Turn requirement conversations into key examples (Example Mapping is its lightweight workshop form), and the examples become acceptance tests. Business rules stop hiding in someone's head.

**Rozanski & Woods Viewpoints & Perspectives — who is the architecture accountable to?**
Seven viewpoints and eight perspectives force you to face the fact that developers are not your only stakeholders. Security, performance, evolvability — each perspective is an interrogation of your architecture. This is the bedrock of continuous architecture: architecture is an ongoing socio-technical activity, not a one-time technical decision.

**DDD, strategic and tactical — the code comes last.**
Bounded contexts, context mapping, aggregates. Note the position: it sits at the end of the combo, because the quality of your model depends on the understanding every earlier step feeds into it.

## Not a pipeline — a loop

In practice these methods never run as a straight line. Questions unearthed in Event Storming send you back to Impact Mapping to refocus; an architectural perspective review forces another modeling workshop. **The handoffs and the doubling-back between methods are where the real craft lives.**

Over the past year I've brought this combo into large AI-driven modernization work: AI agents working along the same methodology — global analysis first, then architecture mapping, then domain modeling, each phase's output feeding the next. The methods didn't become obsolete because of AI; they became the skeleton for orchestrating agents. **AI accelerates the execution, but understanding the problem first is still a human's job.**

## Want to practice?

Every method here has a real training ground in this community: the [annual conference](/en/events/) regularly runs Event Storming and Domain Storytelling workshops, the [knowledge base](/en/knowledge/) has an entry for every book mentioned above, and there are two 320+ star Event Storming workshop repos on [GitHub](https://github.com/ddd-tw) you can follow along with.

Understand the problem first. See you at the community.
