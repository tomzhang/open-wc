import createRollupResolve from '@rollup/plugin-node-resolve';
import { Plugin as RollupPlugin } from 'rollup';
import path from 'path';
import { URL, pathToFileURL, fileURLToPath } from 'url';
import whatwgUrl from 'whatwg-url';
import { Plugin } from '../Plugin';
import { toBrowserPath } from '../utils/utils';

const nodeResolvePackageJson = require('@rollup/plugin-node-resolve/package.json');

const fakePluginContext = {
  meta: {
    rollupVersion: nodeResolvePackageJson.peerDependencies.rollup,
  },
  warn(...msg: string[]) {
    console.warn('[es-dev-server] node-resolve: ', ...msg);
  },
};

export function nodeResolvePlugin(): Plugin {
  let fileExtensions: string[];
  let rootDir: string;
  let nodeResolve: RollupPlugin;

  return {
    async serverStart({ config }) {
      ({ rootDir, fileExtensions } = config);
      const options = {
        rootDir,
        // allow resolving polyfills for nodejs libs
        preferBuiltins: false,
        extensions: fileExtensions,
        ...(typeof config.nodeResolve === 'object' ? config.nodeResolve : {}),
      };
      nodeResolve = createRollupResolve(options);

      // call buildStart
      const preserveSymlinks = options?.customResolveOptions?.preserveSymlinks;
      nodeResolve.buildStart?.call(fakePluginContext as any, { preserveSymlinks });
    },

    async resolveImport({ source, context }) {
      if (whatwgUrl.parseURL(source) != null) {
        // don't resolve urls
        return source;
      }
      const [withoutHash, hash] = source.split('#');
      const [importPath, params] = withoutHash.split('?');

      const relativeImport = importPath.startsWith('.') || importPath.startsWith('/');
      const jsFileImport = fileExtensions.includes(path.extname(importPath));
      // for performance, don't resolve relative imports of js files. we only do this for js files,
      // because an import like ./foo/bar.css might actually need to resolve to ./foo/bar.css.js
      if (relativeImport && jsFileImport) {
        return source;
      }

      const fileUrl = new URL(`.${context.path}`, `${pathToFileURL(rootDir)}/`);
      const filePath = fileURLToPath(fileUrl);

      // do the actual resolve using the rolluo plugin
      const result = await nodeResolve.resolveId?.call(
        fakePluginContext as any,
        importPath,
        filePath,
      );
      let resolvedImportFilePath;

      if (result) {
        if (typeof result === 'string') {
          resolvedImportFilePath = result;
        } else if (typeof result.id === 'string') {
          resolvedImportFilePath = result.id;
        }
      }

      if (!resolvedImportFilePath) {
        throw new Error(
          `Could not resolve import "${importPath}" in "${path.relative(
            process.cwd(),
            filePath,
          )}".`,
        );
      }

      const relativeImportFilePath = path.relative(path.dirname(filePath), resolvedImportFilePath);
      const suffix = `${params ? `?${params}` : ''}${hash ? `#${hash}` : ''}`;
      const resolvedImportPath = `${toBrowserPath(relativeImportFilePath)}${suffix}`;
      return resolvedImportPath.startsWith('/') || resolvedImportPath.startsWith('.')
        ? resolvedImportPath
        : `./${resolvedImportPath}`;
    },
  };
}
