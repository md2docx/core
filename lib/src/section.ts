import type { Root } from "@m2d/mdast";
import { DEFAULT_SECTION_PROPS, getTextContent } from "./utils";
import type {
  BlockNodeChildrenProcessor,
  Definitions,
  FootnoteDefinitions,
  ISectionProps,
  InlineChildrenProcessor,
  InlineDocxNodes,
  IPlugin,
  IDefaultMdastToDocxSectionProps,
  DocxSection,
} from "./utils";
import {
  Bookmark,
  BorderStyle,
  CheckBox,
  ExternalHyperlink,
  FootnoteReferenceRun,
  InternalHyperlink,
  IParagraphOptions,
  Paragraph,
  TextRun,
} from "docx";
// skipcq: JS-C1003
import * as docx from "docx";

/**
 * Creates an inline content processor that converts MDAST inline elements to DOCX-compatible runs.
 * @param definitions - Map of definitions
 * @param footnoteDefinitions - Map of footnote definitions
 * @param imageResolver - Function to resolve image URLs to IImageOptions
 * @returns Function that processes inline node children recursively
 */
const createInlineProcessor = (
  definitions: Definitions,
  footnoteDefinitions: FootnoteDefinitions,
  plugins: IPlugin[],
  trimInnerSpaces: boolean,
) => {
  const normalizeText = (text: string) => (trimInnerSpaces ? text.replace(/ +/g, " ") : text);
  /** inline node children processor */
  const processInlineNodeChildren: InlineChildrenProcessor = (node, runProps = {}) =>
    (
      node.children?.map(node => {
        const docxNodes: InlineDocxNodes[] = plugins
          .map(
            plugin =>
              plugin.inline?.(
                docx,
                node,
                runProps,
                definitions,
                footnoteDefinitions,
                processInlineNodeChildren,
              ) ?? [],
          )
          .flat();

        const newRunProps = Object.assign({}, runProps, node.data);
        // @ts-expect-error - node might not have url or identifier, but we are already handling those cases.
        const url = node.url ?? definitions[node.identifier?.toUpperCase()];

        switch (node.type) {
          case "text":
            return [
              ...docxNodes,
              ...(newRunProps.pre
                ? node.value
                    .split("\n")
                    .map(
                      text => new TextRun({ text: normalizeText(text), ...newRunProps, break: 1 }),
                    )
                : [
                    new TextRun({
                      text: normalizeText(node.value),
                      ...newRunProps,
                    }),
                  ]),
            ];
          case "checkbox":
            // skipcq: JS-0066
            return [...docxNodes, new CheckBox({ checked: !!node.checked })];
          case "break":
            return [...docxNodes, new TextRun({ break: 1 })];
          case "inlineCode":
            return [
              ...docxNodes,
              new TextRun({
                text: normalizeText(node.value),
                ...newRunProps,
                style: "code",
                font: { name: "Consolas" },
              }),
            ];
          case "emphasis":
            newRunProps.italics = true;
            return [...docxNodes, ...processInlineNodeChildren(node, newRunProps)];
          case "strong":
            newRunProps.bold = true;
            return [...docxNodes, ...processInlineNodeChildren(node, newRunProps)];
          case "delete":
            newRunProps.strike = true;
            return [...docxNodes, ...processInlineNodeChildren(node, newRunProps)];
          case "link":
          case "linkReference":
            // newRunProps.add("link");
            // newRunProps.style = "link";
            newRunProps.underline = {};
            return [
              ...docxNodes,
              url.startsWith("#")
                ? new InternalHyperlink({
                    anchor: url.slice(1),
                    children: processInlineNodeChildren(node, newRunProps),
                  })
                : new ExternalHyperlink({
                    link: url,
                    children: processInlineNodeChildren(node, newRunProps),
                  }),
            ];
          case "footnoteReference":
            return [
              ...docxNodes,
              new FootnoteReferenceRun(footnoteDefinitions[node.identifier].id ?? 0),
            ];
          case "fragment":
            return [...docxNodes, ...processInlineNodeChildren(node, newRunProps)];
          // Already handled by a plugin
          case "":
            return [...docxNodes];
          default:
            console.warn(`Unsupported inline node type: ${node.type}`);
            return [...docxNodes];
        }
      }) ?? []
    ).flat();

  return processInlineNodeChildren;
};

/**
 * Converts an MDAST tree to a DOCX document section.
 * @param node - The root MDAST node
 * @param definitions - Definitions mapping
 * @param footnoteDefinitions - Footnote definitions mapping
 * @param props - Section properties (optional)
 * @returns A DOCX section representation
 */
export const toSection = async (
  node: Root,
  definitions: Definitions,
  footnoteDefinitions: FootnoteDefinitions,
  props?: ISectionProps,
): Promise<DocxSection> => {
  const { plugins, useTitle, trimInnerSpaces, ...sectionProps } = {
    ...DEFAULT_SECTION_PROPS,
    ...props,
  } as IDefaultMdastToDocxSectionProps;

  for (const plugin of plugins) await plugin.preprocess?.(node, definitions);

  const processInlineNodeChildren = createInlineProcessor(
    definitions,
    footnoteDefinitions,
    plugins,
    trimInnerSpaces,
  );

  /** process block node children */
  const processBlockNodeChildren: BlockNodeChildrenProcessor = (node, paraProps) =>
    node.children
      ?.map(node => {
        const newParaProps = { ...paraProps };
        const docxNodes = plugins
          .map(
            plugin =>
              plugin.block?.(
                docx,
                node,
                newParaProps,
                processBlockNodeChildren,
                processInlineNodeChildren,
              ) ?? [],
          )
          .flat();
        Object.assign(newParaProps, node.data);
        switch (node.type) {
          // case "root":
          //   return [...docxNodes, ...( processBlockNodeChildren(node, newParaProps))];
          case "paragraph": {
            const preStyles: IParagraphOptions = newParaProps.pre ? { alignment: "left" } : {};
            const checkbox =
              typeof newParaProps.checked === "boolean"
                ? [
                    new CheckBox({
                      checked: newParaProps.checked,
                      checkedState: { value: "2611" },
                      uncheckedState: { value: "2610" },
                    }),
                    new TextRun(" "),
                  ]
                : [];
            return [
              ...docxNodes,
              new Paragraph({
                ...preStyles,
                ...newParaProps,
                children: [
                  ...checkbox,
                  // @ts-expect-error -- passing all data
                  ...processInlineNodeChildren(node, newParaProps),
                ],
              }),
            ];
          }
          case "heading":
            return [
              new Paragraph({
                ...newParaProps,
                ...docxNodes,
                // @ts-expect-error - TypeScript does not infer depth to always be between 1 and 6, but it is ensured by MDAST specs
                heading: useTitle
                  ? node.depth === 1
                    ? "Title"
                    : `Heading${node.depth - 1}`
                  : `Heading${node.depth}`,
                children: [
                  new Bookmark({
                    id: getTextContent(node).replace(/[. ]+/g, "-").toLowerCase(),
                    // @ts-expect-error -- passing all data
                    children: processInlineNodeChildren(node, newParaProps),
                  }),
                ],
              }),
            ];
          case "code":
            return [
              ...docxNodes,
              new Paragraph({
                border: {
                  bottom: { style: BorderStyle.SINGLE, space: 5, size: 1 },
                  left: { style: BorderStyle.SINGLE, space: 10, size: 1 },
                  right: { style: BorderStyle.SINGLE, space: 5, size: 1 },
                  top: { style: BorderStyle.SINGLE, space: 6, size: 1 },
                },
                ...newParaProps,
                alignment: "left",
                style: "blockCode",
                keepLines: true,
                children: node.value.split("\n").map(
                  (line, i) =>
                    // @ts-expect-error -- ok to pass extra data
                    new TextRun({
                      ...newParaProps,
                      text: line,
                      break: i === 0 ? 0 : 1,
                      style: "code",
                      font: { name: "Consolas" },
                    }),
                ),
              }),
            ];
          case "list":
            if (node.ordered) {
              newParaProps.bullet = { level: (newParaProps.bullet?.level ?? -1) + 1 };
              console.warn(
                "Please add numbering plugin to support ordered lists. For now, we use only bullets for both the ordered and the unordered list.",
              );
            } else {
              newParaProps.bullet = { level: (newParaProps.bullet?.level ?? -1) + 1 };
            }
            return [...docxNodes, ...processBlockNodeChildren(node, newParaProps)];
          case "blockquote":
            // newParaProps.indent = { left: 720, hanging: 360 };
            return [...docxNodes, ...processBlockNodeChildren(node, newParaProps)];
          case "listItem":
            newParaProps.checked = node.checked;
            return [...docxNodes, ...processBlockNodeChildren(node, newParaProps)];
          case "thematicBreak":
            return [
              ...docxNodes,
              new Paragraph({
                ...node.data,
                border: { top: { style: BorderStyle.SINGLE, size: 6 } },
              }),
            ];
          case "definition":
          case "footnoteDefinition":
            return docxNodes;
          case "table":
            console.warn("Please add table plugin to support tables.");
            return docxNodes;
          case "fragment":
            return [...docxNodes, ...processBlockNodeChildren(node, newParaProps)];
          case "":
            return docxNodes;
          case "yaml":
          case "html":
          default:
            console.warn(`May be an unsupported node type: ${node.type}`, node);
            return docxNodes;
        }
      })
      .flat();

  return { ...sectionProps, children: processBlockNodeChildren(node, {}) };
};

export { docx };
