import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { glob } from 'glob';
import type { Path } from 'path-scurry';

interface ErrorWithOutput extends Error {
  output: string;
}

function executeCommand(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data;
    });

    child.stderr.on('data', (data) => {
      errorOutput += data;
    });

    child.on('error', (error) => {
      reject(Object.assign(error, { output: errorOutput }));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`${command} exited with code ${code}`);
        Object.assign(error, { output: errorOutput });
        reject(error);
        return;
      }
      resolve(output.trim());
    });
  });
}

export async function getTarball(
  packageName: string,
  workingDirectory: string,
  { npmrc, verbose }: { npmrc?: string; verbose?: boolean; } = {}) {
  try {
    const args = ['pack', packageName, '--pack-destination', workingDirectory];
    if (npmrc) {
      args.push('--userconfig', npmrc);
    }
    const tar = await executeCommand('npm', args, workingDirectory);
    const tarout = await executeCommand('tar', ['xvzf', tar], workingDirectory);
    if (verbose) {
      console.log(tarout);
    }
    return path.join(workingDirectory, 'package');
  } catch (error) {
    if ((error as ErrorWithOutput).output?.includes('404 Not Found')) {
      throw Object.assign(new Error(`Package ${packageName} not found`), { status: 404 });
    }
    throw error;
  }
}

export async function getGlobMatches(globs: string[], cwd?: string) {
  return Promise.all(
    globs.map((pattern: string) => glob(pattern, { cwd, nodir: true, withFileTypes: true })),
  ).then((files) => files.flatMap((f) => f));
}

async function areSame(localFile: Path, publishedFile: Path, checkWithoutVersion: boolean) {
  const localContent = await fs.readFile(localFile.fullpath());
  const publishedContent = await fs.readFile(publishedFile.fullpath());

  if (Buffer.compare(localContent, publishedContent) === 0) {
    return true;
  }
  if (!checkWithoutVersion) {
    return false;
  }
  const localPackage = JSON.parse(localContent.toString('utf-8'));
  const publishedPackage = JSON.parse(publishedContent.toString('utf-8'));
  delete localPackage.version;
  delete publishedPackage.version;
  return JSON.stringify(localPackage) === JSON.stringify(publishedPackage);
}

export async function compareFiles(
  localFiles: Path[],
  publishedFiles: Path[],
  options: {
    ignorePackageVersion?: boolean;
    verbose?: boolean;
  } = {},
) {
  // Compare the contents of each file in localFiles to the corresponding file in publishedFiles
  // If any files are different, return false. If ignorePackageVersion is true, ignore differences in the version
  // tag in package.json.
  const { ignorePackageVersion = false } = options;
  const localFilesMap = new Map<string, Path>();
  const publishedFilesMap = new Map<string, Path>();
  localFiles.forEach((f) => localFilesMap.set(f.relative(), f));
  publishedFiles.forEach((f) => publishedFilesMap.set(f.relative(), f));
  const allFiles = new Set([...localFilesMap.keys(), ...publishedFilesMap.keys()]);
  let same = true;

  if (options.verbose) {
    console.log('Local files:', localFilesMap.keys());
    console.log('Published files:', publishedFilesMap.keys());
  }

  for (const file of allFiles) {
    const localFile = localFilesMap.get(file);
    const publishedFile = publishedFilesMap.get(file);
    if (!localFile || !publishedFile) {
      same = false;
      if (!options.verbose) {
        return false;
      }
      console.log(`${file} is missing from ${localFile ? 'published' : 'local'} files`);
      continue;
    }
    const curFileSame = await areSame(
      localFile,
      publishedFile,
      ignorePackageVersion && file === 'package.json',
    );
    if (!curFileSame) {
      same = false;
      if (options.verbose) {
        console.log(`${file} is different`);
      } else {
        return false;
      }
    }
  }

  if (options.verbose && same) {
    console.log('All files are the same');
  }
  return same;
}
