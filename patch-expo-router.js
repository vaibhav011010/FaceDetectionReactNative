const fs = require("fs");
const path = require("path");

// Path to the file we need to patch
const ctxFilePath = path.join("node_modules", "expo-router", "_ctx.android.js");

// Check if the file exists
if (fs.existsSync(ctxFilePath)) {
  // Read the file content
  const content = fs.readFileSync(ctxFilePath, "utf8");

  // Replace the problematic line
  const patchedContent = content.replace(
    /require\.context\(process\.env\.EXPO_ROUTER_APP_ROOT/g,
    'require.context("./app"'
  );

  // Write the patched content back
  fs.writeFileSync(ctxFilePath, patchedContent);

  console.log("Successfully patched expo-router/_ctx.android.js");
} else {
  console.error("Could not find expo-router/_ctx.android.js file");
}
