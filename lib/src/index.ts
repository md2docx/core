import { IPlugin } from "@m2d/core";
import emojis from "./emoji.json";

export const emojiPlugin: () => IPlugin = () => ({
  inline: async (_docx, node) => {
    if (node.type === "text") {
      node.value = node.value.replace(
        /:[a-z0-9_+-]+:/g,
        (match: keyof typeof emojis) => emojis[match] ?? match,
      );
    }
    return [];
  },
});
