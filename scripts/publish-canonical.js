const { execSync } = require("child_process");

// Publish canonical packages
["@md2docx/core", "@mdast2docx/core"].forEach(pkg => {
  execSync(`sed -i -e "s/name.*/name\\": \\"${pkg}\\",/" lib/package.json`);
  execSync("cd lib && npm publish --provenance --access public");
});
