```ts
function htmlImportPlugin() {
  return {
    serve({ path, url, ctx }) {
      return { body, contentType, status };
    },

    resolveImport({ source, path, url }) {},

    transform({ body, path, url, headers }) {},

    cacheKey(),
  };
}
```

TODO:

- linting
- throw resolve syntax error in resolve module imports (see TODO in reoslvemoduleimportsplugin)
