#!/usr/bin/env node

/* eslint-disable no-console */
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

import minimist from 'minimist';

import { compareFiles, getGlobMatches, getTarball } from '../index.js';

interface Argv {
  _: string[];
  help?: boolean;
  verbose?: boolean;
  // Same = check that the files are the same, exit code 0 if same
  // Diff = check that the files are different, exit code 0 if different
  check?: 'same' | 'diff';
  ignoreVersion?: boolean;
  localDir?: string;
  npmrc?: string;
}

const argv = minimist<Argv>(process.argv.slice(2), {
  alias: {
    h: 'help',
    v: 'verbose',
    c: 'check',
    'local-dir': 'localDir',
    'ignore-version': 'ignoreVersion',
  },
  boolean: ['help', 'verbose'],
});

const [targetPackage, ...globs] = argv._;

async function run() {
  const tmp = path.join(os.tmpdir(), `npm-pack-tarball-${Date.now()}`);
  await fs.mkdir(tmp);
  try {
    const tarballDirectory = await getTarball(targetPackage, tmp, argv.npmrc).catch((error) => {
      if (error.status === 404) {
        // Treat it as empty
        return path.join(tmp, 'package');
      }
      throw error;
    });
    const tarballFiles = await getGlobMatches(globs as string[], tarballDirectory);
    const localFiles = await getGlobMatches(globs as string[], argv.localDir);

    const same = await compareFiles(localFiles, tarballFiles, {
      ignorePackageVersion: argv.ignoreVersion,
      verbose: argv.verbose,
    });

    const { check = 'same' } = argv;
    if (same && check === 'same') {
      if (argv.verbose) {
        console.log('Files are the same, test passes');
      }
      process.exit(0);
    }
    if (!same && check === 'diff') {
      console.log('Files are different, test passes');
      process.exit(0);
    }
    console.log(`Files are ${check === 'diff' ? 'the same' : 'different'}, test fails`);
    process.exit(1);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
