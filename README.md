# check-package-changes

This package compares a set of local files with the current published NPM version of a target package. This can be useful for things like generated modules (think OpenAPI specifications) where you would like to know if the generated
code matches the currently published code or not.

For example:

```
npx @sesamecare-oss/check-package-changes --verbose --ignore-version --local-dir generated "dist/**" package.json spec.json
```

* `--verbose` will print out the name of any file that is not the same between the sources
* `--ignore-version` will ignore the version value in package.json (assuming package.json was specified) which can be useful when your package version is not yet known locally.
* `--local-dir` points to the directory containing the files (cwd is used otherwise)
* `"dist/**" package.json spec.json` - these are the files (or glob patterns) that are examined in both sources.
