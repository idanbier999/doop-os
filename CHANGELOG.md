# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-03-15

Initial open-source release.

### Added

- Multi-workspace support with role-based access control (owner, admin, member)
- AI agent fleet management: registration, health monitoring, heartbeat detection
- Automatic offline detection for agents with no heartbeat in 5 minutes
- Agent tagging, filtering, and bulk operations
- Agent ownership assignment and fleet scoping
- Project orchestration with manual and lead-agent autonomous modes
- Task CRUD with dependency DAG and auto-dispatch on completion
- Task agent assignments (primary/helper roles) with auto-sync to tasks
- Webhook dispatch with HMAC-SHA256 signing and delivery tracking
- Problems/incidents tracking with severity levels
- Activity timeline and audit log per workspace
- Real-time monitoring via Supabase Realtime subscriptions
- Slack notifications for agent problems (configurable per workspace)
- File attachments on projects with drag-and-drop upload
- Workspace invitation system with token-based links
- API rate limiting with per-agent quotas
- Better Auth integration (email/password + Google OAuth)
- Supabase Row Level Security on all 23 tables
- 63 RLS policies for workspace-scoped access control
- 14 database functions (workspace helpers, rate limiting, auto-dispatch, etc.)
- 10 triggers (updated_at, dispatch, project status sync, Slack, webhooks)
- Comprehensive test suite (Vitest + Testing Library)
- CI/CD pipeline (GitHub Actions: lint, typecheck, test)
- Pre-commit hooks (Husky + lint-staged + Prettier)
- Initial database migration for full schema setup
- Environment variable validation with runtime checks
- Documentation: architecture, product overview, API reference
