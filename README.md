# VCF Prefix Editor

A web application with a Slovak interface for loading VCF contacts, editing phone numbers, and changing phone prefixes in bulk. Available for personal and commercial use under the [MIT License](LICENSE).

The application runs entirely in the browser. VCF files and contact data are never uploaded to a server.

## Features

- Load a `.vcf` file using the file picker or drag and drop
- Support for vCard 2.1, 3.0, and 4.0
- Change a phone prefix in bulk, for example from `+420` to `+421`
- Edit individual phone numbers manually
- Search contacts by name or phone number
- Preserve all other contact data
- Export edited contacts to a new VCF file
- Local processing with no registration or database
- Responsive interface for desktop and mobile devices

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A modern web browser
- npm, which is included with Node.js

The project has no external JavaScript dependencies, so running `npm install` is not required.

## Running Locally

From the repository directory, start the local development server:

```bash
npm run dev
```

Then open the application at:

```text
http://localhost:4173
```

Press `Ctrl+C` to stop the server.

## Production Build

Create the static production files in the `dist` directory:

```bash
npm run build
```

Deploy the contents of `dist/` to a static hosting provider. The build includes `LICENSE` so the copyright and permission notice accompany redistributed files. Node.js is only needed for local development and building; the deployed application runs in the browser.

The generated `dist/` directory is ignored by Git. Run `npm run build` after checking out the repository and whenever source files change. For automated deployments, use `npm run build` as the build command and `dist` as the publish directory.

To preview the production build locally, run:

```bash
npm run preview
```

## Tests

Run the automated tests for the VCF parser and phone-number editing logic:

```bash
npm test
```

The tests cover:

- Parsing contacts and phone properties
- Replacing a prefix only when it appears at the beginning of a number
- Preserving the `tel:` URI format
- Preserving unmodified VCF properties
- Restoring the original number and line folding

## Usage

1. Open the application.
2. Select a `.vcf` file or drag it into the upload area.
3. Enter the old and new phone prefixes.
4. Click **Nahradiť predvoľbu** (Replace prefix).
5. Edit individual phone numbers manually if needed.
6. Click **Stiahnuť upravený VCF** (Download edited VCF).

The original file remains unchanged. The application creates a new file with the `-upravene.vcf` suffix.

## How Prefix Replacement Works

Only phone numbers that begin with the exact specified value are changed.

Example:

```text
Old prefix: +420
New prefix: +421

+420 901 234 567  →  +421 901 234 567
00420 901 234 567 →  remains unchanged
```

To update numbers beginning with `00420`, perform a separate replacement for that prefix.

## Privacy and Security

- Files are processed locally using JavaScript in the browser.
- Contacts are not uploaded to any server.
- The application does not use analytics, cookies, or external APIs.
- Loaded data is discarded when the page is closed or refreshed.

When working with sensitive contacts, keep a backup of the original VCF file before importing the edited version.

## Project Structure

```text
.
├── index.html          # User interface
├── styles.css          # Styling and responsive design
├── app.js              # Application and user-interface logic
├── vcf.js              # VCF parsing, editing, and exporting
├── scripts/
│   ├── build.mjs       # Creates the production dist directory
│   └── serve.mjs       # Local static server
├── test/
│   └── vcf.test.mjs    # Automated tests
├── dist/               # Generated production build, ignored by Git
├── .gitignore          # Excludes generated and local files
├── LICENSE             # MIT license and copyright notice
└── package.json
```

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Serves the source files at `http://localhost:4173` |
| `npm run build` | Creates a production build in the `dist` directory |
| `npm run preview` | Serves the contents of the `dist` directory |
| `npm test` | Runs the automated tests |

## Limitations

- The maximum accepted file size is 20 MB.
- Contact names using older quoted-printable encoding might not always be displayed correctly in the preview.
- The application edits `TEL` properties and preserves other contact properties without modification.

## License and Commercial Use

Copyright (c) 2026 Filip Hromada. Licensed under the [MIT License](LICENSE).

- Commercial use, modification, distribution, sublicensing, and sale are permitted.
- Include the copyright and permission notice in all copies or substantial portions of the software. Keep `LICENSE` with redistributed source and production builds.
- The software is provided "as is", without warranty. See [LICENSE](LICENSE) for the full terms.
