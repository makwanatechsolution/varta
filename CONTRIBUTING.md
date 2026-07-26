# Contributing to Varta

Thank you for your interest in contributing to **Varta**! We welcome contributions from developers of all skill levels.

---

## 1. Development Guidelines & Code Standards

- **Language & Framework**: TypeScript 5.x, React 19, Vite 8, Tailwind CSS v4.
- **Strict Typing**: All components and API utilities must be fully typed. Avoid using `any` unless absolutely necessary.
- **Code Style**:
  - Use 2-space indentation.
  - Follow the Single Responsibility Principle for components and hooks.
  - Keep components focused (< 250 lines per file).
- **Theme Consistency**: Always use CSS variables (`bg-[#0b141a]`, `bg-[#111b21]`, `text-white`, `border-zinc-800`) or theme tokens (`bg-main`, `bg-card`) to preserve dark-mode consistency across views.

---

## 2. Pull Request & Commit Workflow

### 2.1 Branch Naming Convention
- `feature/feature-name` (e.g. `feature/voice-note-waveform`)
- `fix/bug-description` (e.g. `fix/profile-avatar-upload`)
- `docs/documentation-update` (e.g. `docs/architecture-diagram`)

### 2.2 Commit Message Standard
Follow Semantic Commit Messages:
- `feat: add WebRTC screen sharing support`
- `fix: resolve RLS policy recursion in profile trigger`
- `docs: update deployment guidelines in README`
- `style: enforce dark theme colors on settings pane`

### 2.3 Pre-PR Quality Verification
Before submitting a Pull Request, run the following validation pipeline:

```bash
# 1. Type Check & Production Build Verification
npm run build

# 2. Code Quality & Lint Audit
npm run lint
```

Ensure all tests and builds succeed with **0 errors**.

---

## 3. License
By contributing to Varta, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
