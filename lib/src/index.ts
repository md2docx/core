import { IPlugin } from "@m2d/core";

export const emojiPlugin: () => IPlugin = () => ({
  inline: async (_docx, node) => {
    if (node.type === "supported_type") {
      /** process node and return array of  */
      node.type = "";
    }
    return [];
  },
});
