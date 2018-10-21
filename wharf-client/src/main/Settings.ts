import * as path from "path";

import * as fs from "fs-extra";

export interface Settings {
    lastConfigPath: string | null;
}

export function readSettings(): Settings {
    const settings: Settings | null = fs.readJSONSync(getSettingsFilePath(), { throws: false });
    return settings || { lastConfigPath: null };
}

export function writeSettings(settings: Settings) {
    fs.ensureDirSync(getSettingsFolder());
    fs.writeJsonSync(getSettingsFilePath(), settings);
}

function getSettingsFilePath() {
    return path.join(getSettingsFolder(), "settings.json");
}

function getSettingsFolder() {
    if (process.platform == "win32") {
        const folder = process.env.LOCALAPPDATA || "~";
        return path.join(folder, "Wharf");
    }
    return path.join("~", ".wharf");
}
