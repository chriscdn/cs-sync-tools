import Rsync from "npm:rsync";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

async function readDirectory(path: string): Promise<Array<string>> {
  const arr: Array<string> = [];
  for await (const entry of Deno.readDir(path)) arr.push(entry.name);
  return arr;
}

async function pathExists(filename: string): Promise<boolean> {
  try {
    await Deno.stat(filename);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error;
    }
  }
}

function rsync(
  rsyncExecutable: string,
  source: string,
  target: string,
  exclude = [
    "*.oll",
    ".svn",
    "node_modules",
    ".git",
    ".gitignore",
    ".gitattributes",
    ".DS_Store",
    "desktop.ini",
  ]
): Promise<number | Error> {
  const source2 = source
    .replace("c:\\", "/cygdrive/c/")
    .replace("c:/", "/cygdrive/c/")
    .replace("e:\\", "/cygdrive/e/")
    .replace("e:/", "/cygdrive/e/");
  const target2 = target
    .replace("c:\\", "/cygdrive/c/")
    .replace("c:/", "/cygdrive/c/")
    .replace("e:\\", "/cygdrive/e/")
    .replace("e:/", "/cygdrive/e/");

  return new Promise((resolve, reject) => {
    new Rsync()
      .executable(rsyncExecutable)
      .archive()
      .exclude(exclude)
      .delete()
      .chmod(755)
      .source(source2)
      .destination(target2)
      .execute((error: Error, code: number, cmd: string) => {
        console.log(cmd);
        if (error) {
          console.log(`FAILED: ${cmd}`);
          reject(error);
        } else {
          resolve(code);
        }
      });
  });
}

type SyncConfig = {
  sourceModules: string;
  targetContentServer: string;
  targetSRC: string;
  rsyncExecutable: string;
  modules: Array<string>;
};

export default async function SynchronizeCS10ToCSIDE(config: SyncConfig) {
  const targetModules = join(config.targetContentServer, "module", "/");
  const targetSupport = join(config.targetContentServer, "support", "/");

  const [allSourceModules, allTargetModules] = await Promise.all([
    readDirectory(config.sourceModules),
    readDirectory(targetModules),
  ]);

  const mappings = config.modules
    .map((moduleName: string) => {
      const name = `${moduleName}_`;
      const iniFileName = `${moduleName}.ini`;
      const sourceModule = allSourceModules.find((item) =>
        item.startsWith(name)
      );
      const targetModule = allTargetModules.find((item) =>
        item.startsWith(name)
      );

      if (sourceModule && targetModule) {
        const sourceModuleDirectory = join(
          config.sourceModules,
          sourceModule,
          "/"
        );
        const targetModuleDirectory = join(targetModules, targetModule, "/");

        return {
          source: sourceModuleDirectory,
          target: targetModuleDirectory,
          sourceSRC: join(
            config.sourceModules,
            sourceModule,
            "src",
            moduleName,
            "/"
          ),
          targetSRC: join(config.targetSRC, moduleName, "/"),
          sourceSupport: join(
            config.sourceModules,
            sourceModule,
            "support",
            "/"
          ),
          targetSupport: join(targetSupport, moduleName, "/"),
          sourceINI: join(sourceModuleDirectory, iniFileName),
          targetINI: join(config.targetSRC, moduleName, iniFileName),
        };
      } else {
        return null;
      }
    })
    .filter((item) => Boolean(item));

  mappings.forEach(async (mapping) => {
    if (await pathExists(mapping!.source)) {
      await rsync(config.rsyncExecutable, mapping!.source, mapping!.target);
    }

    if (await pathExists(mapping!.sourceSRC)) {
      await rsync(
        config.rsyncExecutable,
        mapping!.sourceSRC,
        mapping!.targetSRC
      );
    }

    if (await pathExists(mapping!.sourceINI)) {
      await rsync(
        config.rsyncExecutable,
        mapping!.sourceINI,
        mapping!.targetINI
      );
    }

    if (await pathExists(mapping!.sourceSupport)) {
      await rsync(
        config.rsyncExecutable,
        mapping!.sourceSupport,
        mapping!.targetSupport
      );
    }
  });
}
