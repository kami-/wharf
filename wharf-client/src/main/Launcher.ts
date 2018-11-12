import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import Registry from "winreg";

import * as fs from "fs-extra";
import { ModFolder } from "wharf-common";

export async function launchArma3(args: string[], repoRootPath: string, mods: ModFolder[], extraMods: string[]) {
    const a3InstallPath = await getArma3InstallPath();
    deployUserConfig(a3InstallPath, repoRootPath, mods);
    const a3Exe = path.join(a3InstallPath, "arma3_x64.exe");
    const modArgValue = mods
        .map(mod => path.join(repoRootPath, mod.name))
        .concat(extraMods)
        .join(";");
    const modArg = `"-mod=${modArgValue}"`;
    const processArgs = args.concat(modArg);
    const a3Process = spawn(a3Exe, processArgs, {
        cwd: a3InstallPath,
        detached: true,
        shell: false
    });
    a3Process.unref();
}

async function getArma3InstallPath() {
    // No linux support
    if (process.platform != "win32") {
        const testPath = path.join(path.resolve(os.homedir()), "a3-test");
        fs.ensureDirSync(testPath);
        return testPath;
    }
    const x64Path = await getRegistryValue("\\SOFTWARE\\Wow6432Node\\bohemia interactive\\arma 3");
    return x64Path || await getRegistryValue("\\SOFTWARE\\bohemia interactive\\arma 3");
}

function getRegistryValue(key: string): Promise<string> {
    return new Promise(resolve => {
        const regKey = new Registry({ hive: Registry.HKLM, key: key });
        regKey.values((err, items) => {
            if (err || !items) { resolve(""); }
            const pathItem = items.find(item => item.name == "main");
            resolve(pathItem ? pathItem.value : "");
        });
    });
}

function deployUserConfig(a3InstallPath: string, repoRootPath: string, mods: ModFolder[]) {
    const a3UserConfigPath = path.join(a3InstallPath, "userconfig");
    mods
        .filter(hasUserConfig)
        .forEach(mod => {
            const modUserConfigPath = path.join(repoRootPath, mod.name, "userconfig");
            fs.copySync(modUserConfigPath, a3UserConfigPath);
        });
}

function hasUserConfig(mod: ModFolder) {
    return mod.modFiles.some(file => file.relativePath.indexOf("userconfig") > -1);
}
