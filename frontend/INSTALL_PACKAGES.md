# Install Required Packages

Due to npm installation issues, please install the packages manually:

## Option 1: Using npm (Recommended)

```bash
cd frontend
npm install lenis@latest gsap@latest
```

## Option 2: If npm fails, try with flags

```bash
cd frontend
npm install lenis@latest gsap@latest --force
```

## Option 3: Using yarn (if available)

```bash
cd frontend
yarn add lenis gsap
```

## Option 4: Manual package.json edit

The packages have already been added to `package.json`. Just run:

```bash
cd frontend
npm install
```

## Verify Installation

After installation, verify the packages are installed:

```bash
npm list lenis gsap
```

You should see both packages listed.

## If Still Having Issues

1. Delete `node_modules` folder
2. Delete `package-lock.json` file
3. Run `npm install` again

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

On Windows PowerShell:
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

