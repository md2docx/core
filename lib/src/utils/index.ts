import {
  ExternalHyperlink,
  ImageRun,
  InternalHyperlink,
  IParagraphOptions,
  TextRun,
  Table,
  Paragraph,
  IRunOptions,
  IPropertiesOptions,
  Math as DOCXMath,
} from "docx";
import * as DOCX from "docx";
import {
  BlockContent,
  DefinitionContent,
  Parent,
  Root,
  RootContent,
  Mutable,
  Optional,
  Node,
  EmptyNode,
} from "@m2d/mdast";

export { convertInchesToTwip, convertMillimetersToTwip } from "docx";

/** Type representing definition mappings */
export type Definitions = Record<string, string>;

/** Type representing footnote definitions */
export type FootnoteDefinitions = Record<
  string,
  { children: (BlockContent | DefinitionContent)[]; id?: number }
>;

/**
 * Extracts definitions and footnote definitions from a list of MDAST nodes.
 *
 * @param nodes - Array of MDAST nodes.
 * @returns An object containing `definitions` and `footnoteDefinitions`.
 */
export const getDefinitions = (nodes: RootContent[]) => {
  const definitions: Definitions = {};
  const footnoteDefinitions: FootnoteDefinitions = {};
  nodes.forEach(node => {
    if (node.type === "definition") {
      definitions[node.identifier.toUpperCase()] = node.url;
    } else if (node.type === "footnoteDefinition") {
      footnoteDefinitions[node.identifier.toUpperCase()] = { children: node.children };
    } else if ((node as Parent).children?.length) {
      Object.assign(definitions, getDefinitions((node as Parent).children));
    }
  });
  return { definitions, footnoteDefinitions };
};

/** Type representing an extended RootContent node
 * - this type is used to avoid type errors when setting type to empty string (in case you want to avoid reprocessing that node.) in plugins
 */
type ExtendedRootContent<T extends Node = EmptyNode> = RootContent | T;

/**
 * Extracts the textual content from a given MDAST node.
 * Recursively processes child nodes if present.
 *
 * @param node - The MDAST node to extract text from.
 * @returns The combined text content of the node and its children.
 */
export const getTextContent = (node: ExtendedRootContent): string => {
  if ((node as Parent).children?.length)
    return (node as Parent).children.map(getTextContent).join("");

  return (node as { value?: string }).value ?? "";
};

/**
 * Default configuration for converting MDAST to DOCX, including title handling and plugin extensions.
 */
export interface IDefaultMdastToDocxSectionProps extends Omit<DOCX.ISectionOptions, "children"> {
  /**
   * If true, H1 corresponds to the title, H2 to Heading1, etc.
   * @default true
   */
  useTitle: boolean;

  /**
   * List of plugins to extend conversion functionality.
   */
  plugins: Array<IPlugin>;
}

/**
 * Defines properties for a document section, omitting the "children" property from ISectionOptions.
 * Also defining properties for MDAST to DOCX conversion
 */

export type ISectionProps = Optional<IDefaultMdastToDocxSectionProps>;

export const DEFAULT_SECTION_PROPS: IDefaultMdastToDocxSectionProps = {
  useTitle: true,
  plugins: [],
};

/**
 * Defines document properties, excluding sections and footnotes (which are managed internally).
 */
export type IDocxProps = Omit<Mutable<IPropertiesOptions>, "sections" | "footnotes">;

export const defaultDocxProps: IDocxProps = {
  styles: {
    default: {
      document: {
        paragraph: {
          spacing: { before: 175, line: 300 },
          alignment: "thaiDistribute",
        },
        run: { size: 24 },
      },
      heading1: { paragraph: { spacing: { before: 350 } } },
      heading2: { paragraph: { spacing: { before: 350 } } },
      heading3: { paragraph: { spacing: { before: 350 } } },
      heading4: { paragraph: { spacing: { before: 350 } } },
      heading5: { paragraph: { spacing: { before: 350 } } },
      heading6: { paragraph: { spacing: { before: 350 } } },
    },
  },
};

/**
 * Mutable version of IRunOptions where all properties are writable.
 */
export type MutableRunOptions = Mutable<Omit<IRunOptions, "children">> & { pre?: boolean };

export type InlineDocxNodes = TextRun | ImageRun | InternalHyperlink | ExternalHyperlink | DOCXMath;
export type InlineProcessor = (
  node: ExtendedRootContent,
  runProps: MutableRunOptions,
) => InlineDocxNodes[];

export type InlineChildrenProcessor = (
  node: Parent,
  runProps?: MutableRunOptions,
) => InlineDocxNodes[];

/**
 * Mutable version of IParagraphOptions where all properties are writable.
 */
export type MutableParaOptions = Omit<Mutable<IParagraphOptions>, "children"> & {
  checked?: boolean | null;
  pre?: boolean;
};

export type BlockNodeProcessor = (
  node: ExtendedRootContent,
  paraProps: MutableParaOptions,
) => (Paragraph | Table)[];

export type BlockNodeChildrenProcessor = (
  node: Parent | Root,
  paraProps: MutableParaOptions,
) => (Paragraph | Table)[];

export interface DocxSection {
  children: (Paragraph | Table)[];
  headers?: {
    readonly default?: DOCX.Header;
    readonly first?: DOCX.Header;
    readonly even?: DOCX.Header;
  };
  footers?: {
    readonly default?: DOCX.Footer;
    readonly first?: DOCX.Footer;
    readonly even?: DOCX.Footer;
  };
  properties?: DOCX.ISectionPropertiesOptions;
}

/**
 * Interface for extending MDAST to DOCX conversion using plugins.
 */
export interface IPlugin<T extends Node = EmptyNode> {
  /**
   * Processes block-level MDAST nodes and converts them to DOCX elements.
   */
  block?: (
    docx: typeof DOCX,
    node: ExtendedRootContent<T>,
    paraProps: MutableParaOptions,
    blockChildrenProcessor: BlockNodeChildrenProcessor,
    inlineChildrenProcessor: InlineChildrenProcessor,
  ) => (Paragraph | Table)[];

  /**
   * Processes inline-level MDAST nodes and converts them to DOCX runs.
   */
  inline?: (
    docx: typeof DOCX,
    node: ExtendedRootContent<T>,
    runProps: MutableRunOptions,
    definitions: Definitions,
    footnoteDefinitions: FootnoteDefinitions,
    inlineChildrenProcessor: InlineChildrenProcessor,
  ) => InlineDocxNodes[];

  /**
   * Modifies document-level DOCX properties, such as styles, numbering, headers, or footers.
   * Useful for applying global formatting customizations.
   */
  root?: (props: IDocxProps) => void;

  /**
   * Preprocesses the MDAST tree before the DOCX conversion begins.
   */
  preprocess?: (tree: Root, definitions: Definitions) => void | Promise<void>;

  /**
   * Post-processes the final DOCX document after conversion.
   * Plugins can use this for cleanup or applying final transformations.
   */
  postprocess?: (sections: DocxSection[]) => void | Promise<void>;
}

/**
 * Deeply merges user options over default options.
 * Later values override earlier ones. Arrays are not merged.
 *
 * @param options - User-provided overrides.
 * @param defaultOptions - Default values.
 * @returns A deeply merged object.
 */
export function mergeOptions<T>(options?: Partial<T>, defaultOptions?: Partial<T>): T {
  const result: any = { ...defaultOptions, ...options };

  if (options) {
    for (const [key, value] of Object.entries(options)) {
      const defaultVal = (defaultOptions as any)?.[key];

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        defaultVal &&
        typeof defaultVal === "object" &&
        !Array.isArray(defaultVal)
      ) {
        result[key] = mergeOptions(value, defaultVal);
      }
    }
  }

  return result as T;
}
