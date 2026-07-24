/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // The engine/type modules use explicit ".js" extensions in their import
    // specifiers (required for plain `tsc`/Node ESM resolution), pointing at
    // ".ts" source files. Webpack doesn't do that remap by default, so teach
    // it to try ".ts"/".tsx" whenever a ".js" specifier doesn't resolve.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
