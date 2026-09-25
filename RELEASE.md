# Release Process

## Version source

The version in `package.json` is the single source of truth. Khaata uses Semantic Versioning:

- `MAJOR`: incompatible product or data changes.
- `MINOR`: backward-compatible features.
- `PATCH`: backward-compatible fixes.

## Prepare a release

1. Update the version in `package.json` and `package-lock.json`:

```powershell
npm version minor --no-git-tag-version
```

Use `patch` for fixes or `major` for breaking changes.

2. Move completed items from `Unreleased` into a dated version section in `CHANGELOG.md`.
3. Run validation:

```powershell
npm install
npm run build
git diff --check
```

4. Commit the release:

```powershell
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release vX.Y.Z"
```

5. Create and push the matching Git tag:

```powershell
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

6. In GitHub, open **Releases**, choose the pushed tag, copy the matching changelog section into the release notes, and publish it.

## Pre-release checklist

- Supabase production environment variables are configured in Vercel.
- Supabase Email authentication is enabled.
- Supabase RLS policies are applied.
- `npm run build` passes.
- The deployed app can sign in, save an income, save an expense, and load data after refresh.
- The Vercel deployment uses the intended commit.
- The changelog and package version match the release tag.
