// Metro config for the Recoup pnpm monorepo.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/* trigger reloads, and let
// Metro resolve dependencies from both the app and the workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The @recoup/* packages are shipped as TypeScript source that uses explicit
// ".js" import specifiers (ESM style). Metro resolves those literally, so when
// a ".js" relative import has no matching file, retry it as ".ts".
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return resolve(context, moduleName, platform);
    } catch {
      return resolve(context, moduleName.replace(/\.js$/, ".ts"), platform);
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
