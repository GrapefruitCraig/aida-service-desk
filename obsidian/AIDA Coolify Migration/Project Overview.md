---
title: Project Overview
project: AIDA Coolify Migration
type: overview
tags: [coolify, aida, migration]
---

# Project Overview

**Goal:** replace Railway with a self-hosted **Coolify** instance on a VPS we
control, so AIDA and future products/agents are hosted internally.

**Primary note:** [[Changelog Synopsis]].

## The approach in one paragraph
Run Coolify in **single-server mode** on a cloud VPS whose firewall *we* manage,
with a domain + Let's Encrypt from day one. Work proceeds **stage by stage**, each
with a hard acceptance gate that must pass before the next begins. When a step needs
someone outside the project, raise a service desk ticket rather than improvising a
workaround — see [[Service Desk Escalation]].

## Stages
0. [[Requirements & Decisions]] — sign-off
1. VPS provisioning & hardening
2. Coolify install + dashboard lockdown
3. Network validation (throwaway app)
4. Deploy AIDA
5. Testing, cutover, decommission

Live progress: [[Stage Tracker]].

## Source of truth
The authoritative runbooks live in the git repo under `docs/coolify/` on branch
`claude/coolify-self-hosted-plan-l86wwr`. This Obsidian folder is the working
knowledge base / synopsis layer over that.
