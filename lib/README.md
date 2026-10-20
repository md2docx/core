> [!IMPORTANT]
> ### 📦 This repository has moved!
>
> Active development and maintenance of **`@m2d/core`** has moved to the unified **[md2docx](https://github.com/md2docx/md2docx)** monorepo.
>
> - 🏠 **Monorepo:** [github.com/md2docx/md2docx](https://github.com/md2docx/md2docx)
> - 📂 **Package Source:** [`packages/core`](https://github.com/md2docx/md2docx/tree/main/packages/core)
> - 📖 **Documentation:** [md2docx.js.org/docs/core](https://md2docx.js.org/docs/core)
> - 💬 **Issues & Pull Requests:** Please submit all new issues, feedback, and PRs in the [md2docx issue tracker](https://github.com/md2docx/md2docx/issues).
>
> *This standalone repository is now archived and retained for historical reference only. Releases and npm updates continue from the monorepo.*

---

# **@m2d/core** <img src="https://raw.githubusercontent.com/mayank1513/mayank1513/main/popper.png" style="height: 40px"/>

[![test](https://github.com/md2docx/core/actions/workflows/test.yml/badge.svg)](https://github.com/md2docx/core/actions/workflows/test.yml) [![Maintainability](https://api.codeclimate.com/v1/badges/aa896ec14c570f3bb274/maintainability)](https://codeclimate.com/github/md2docx/core/maintainability) [![codecov](https://codecov.io/gh/md2docx/core/graph/badge.svg)](https://codecov.io/gh/md2docx/core) [![Version](https://img.shields.io/npm/v/@m2d/core.svg?colorB=green)](https://www.npmjs.com/package/@m2d/core) [![Downloads](https://img.jsdelivr.com/img.shields.io/npm/d18m/@m2d/core.svg)](https://www.npmjs.com/package/@m2d/core) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/@m2d/core)

> The core engine that powers `mdast2docx` — convert Markdown Abstract Syntax Trees (MDAST) into DOCX effortlessly.

## ✨ Features

- ✅ Lightweight and fast MDAST to DOCX conversion
- ✅ Works on both **client-side** and **server-side** environments
- ✅ Built-in support for section-based rendering
- ✅ Plugin-friendly architecture

> **Note:** With a lean core, functionality can be extended via plugins such as `@m2d/html`, `@m2d/image`, `@m2d/table`, etc.

---

## 📦 Installation

```bash
pnpm install @m2d/core
```

**_or_**

```bash
yarn add @m2d/core
```

**_or_**

```bash
npm add @m2d/core
```

---

## 🚀 Usage

```ts
import { toDocx } from "@m2d/core";

const docxBlob = await toDocx(mdast, docxProps, sectionProps);
```

---

## 🔌 Plugins

`@m2d/core` supports both official and community plugins to extend its capabilities. For example:

```ts
import { toDocx } from "@m2d/core";
import { imagePlugin } from "@m2d/image";

await toDocx(mdast, docxProps, {
  plugins: [imagePlugin()],
});
```

> 🔍 Use only the plugins you need for better performance and bundle size.
> 🧠 You can use official plugins, or build your own custom ones to keep the bundle size minimal and functionality scoped.

### `@m2d/core` official plugins:

| Plugin         | Package                                                  | Purpose                  |
| -------------- | -------------------------------------------------------- | ------------------------ |
| HTML           | [`@m2d/html`](https://www.npmjs.com/package/@m2d/html)   | Handle raw HTML nodes    |
| Image          | [`@m2d/image`](https://www.npmjs.com/package/@m2d/image) | Embed images in DOCX     |
| Math           | [`@m2d/math`](https://www.npmjs.com/package/@m2d/math)   | Render LaTeX math        |
| Table          | [`@m2d/table`](https://www.npmjs.com/package/@m2d/table) | Markdown tables          |
| List           | [`@m2d/list`](https://www.npmjs.com/package/@m2d/list)   | Advanced list formatting |
| Extended MDAST | [`@m2d/mdast`](https://www.npmjs.com/package/@m2d/mdast) | Extended mdast types     |

---

## 📜 API

### `toDocx(astInputs, docxProps, defaultSectionProps, outputType?)`

| Param                              | Type                                               | Description                               |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| `astInputs`                        | `Root` or `{ ast: Root; props?: ISectionProps }[]` | The parsed Markdown AST                   |
| `docxProps` _(optional)_           | `IDocxProps`                                       | Document metadata and style               |
| `defaultSectionProps` _(optional)_ | `ISectionProps`                                    | Default layout configuration for sections |
| `outputType` _(optional)_          | `OutputType`                                       | (defaults to `'blob'`)                    |

Returns a `Promise` resolving to a DOCX Blob, Buffer, or Base64 string.

### ISectionProps

The `ISectionProps` interface extends DOCX section options with additional MDAST conversion properties:

```ts
interface ISectionProps {
  // DOCX section properties (headers, footers, page settings, etc.)
  // ... all ISectionOptions properties except 'children'
  
  // MDAST to DOCX conversion properties
  useTitle?: boolean;           // H1 as title, H2 as Heading1, etc. (default: true)
  plugins?: Array<IPlugin>;     // Plugins to extend conversion functionality
  trimInnerSpaces?: boolean;    // Trim multiple whitespaces in text (default: true)
  footnoteProps?: MutableParaOptions & MutableRunOptions; // Custom footnote styling
}
```

**Key Properties:**
- `useTitle` - Controls heading hierarchy mapping (default: `true`)
- `plugins` - Array of plugins to extend conversion capabilities
- `trimInnerSpaces` - Normalizes whitespace in text nodes (default: `true`)
- `footnoteProps` - Custom paragraph and run styling for footnote content
- Plus all standard DOCX section properties for page layout, headers, footers, etc.

## 🤖 Generative AI Use-case

AI tools often generate Markdown — `@m2d/core` helps convert them into rich DOCX reports or presentations. This is useful in:

- AI-generated blogs, documentation, and research reports
- Client-side and server-side rendering of AI-generated content
- Integrating in GenAI pipelines with format export capabilities

---

## 💡 Inspiration & Relevance

This library is especially useful in:

- **Generative AI** — Convert Markdown outputs (e.g., from ChatGPT, LLMs) to downloadable DOCX reports
- **Developer Tools** — Export Markdown-based documentation or changelogs as DOCX
- **Education** — Convert notes, quizzes, or assignments authored in Markdown

> ✅ Works both on **client side** and **server side** — offload to browser or use high-performance Node.js.

## 🛠️ Development

```bash
git clone https://github.com/tiny-md/mdast2docx
cd mdast2docx/m2d/core
pnpm install
pnpm dev
```

---

## 📄 License

Licensed under the **MPL-2.0** License.

---

## ⭐ Support Us

If you find this useful:

- ⭐ Star [mdast2docx](https://github.com/tiny-md/mdast2docx) on GitHub
- ❤️ Consider [sponsoring](https://github.com/sponsors/mayank1513)

---

<p align="center">Made with 💖 by <a href="https://mayank-chaudhari.vercel.app" target="_blank">Mayank Kumar Chaudhari</a></p>

> _with `@m2d/core`, bring structure, style, and extensibility to your Markdown-to-DOCX pipeline._
