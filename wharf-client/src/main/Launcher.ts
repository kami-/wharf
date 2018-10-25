import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

import * as fs from "fs-extra";
import { ModFolder } from "wharf-common";

export function launchArma3(args: string[], repoRootPath: string, mods: ModFolder[]) {
    const a3InstallPath = getArma3InstallPath();
    deployUserConfig(a3InstallPath, repoRootPath, mods);
    //const a3Exe = path.join(a3InstallPath, "arma3_x64.exe");
    const a3Exe = path.join(a3InstallPath, "arma3_x64");
    const modArgValue = mods
        .map(mod => path.join(repoRootPath, mod.name))
        .join(";");
    const modArg = `"-mod=${modArgValue}"`;
    const processArgs = args.concat(modArg);
    const a3Process = spawn(a3Exe, processArgs, {
        detached: true,
        cwd: a3InstallPath,
        shell: false,
        windowsHide: true
    });
    a3Process.unref();
}

function getArma3InstallPath() {
    // No linux support
    if (process.platform != "win32") {
        const testPath = path.join(path.resolve(os.homedir()), "a3-test");
        fs.ensureDirSync(testPath);
        return testPath;
    }
    return "";
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
