import * as path from "path";
import * as url from "url";

import { app, BrowserWindow, shell } from "electron";
import * as log from "electron-log";

import * as App from "./App";
import { configureLogging } from "./Settings";

configureLogging();
log.info("Starting...");
log.info(app.getName());
log.info(app.getVersion());

const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
let mainWindow: BrowserWindow | null;

function createMainWindow(closedHandler: () => void) {
    const window = new BrowserWindow({
        width: 800,
        height: 600
    });
    if (IS_DEVELOPMENT) {
        window.webContents.openDevTools();
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
    } else {
        window.loadURL(url.format({
            slashes: true,
            protocol: "file:",
            pathname: path.join(__dirname, "index.html")
        }));
    }
    window.on("closed", () => {
        mainWindow;
        mainWindow = null;
        closedHandler();
    });
    window.webContents.on("devtools-opened", () => {
        window.focus();
        setImmediate(() => { window.focus() });
    });
    return window;
}

// Security
app.on("web-contents-created", (event, contents) => {
    if (IS_DEVELOPMENT) { return; }
    contents.on("will-attach-webview", (event, webPreferences, params) => {
        delete webPreferences.preload;
        delete webPreferences.preloadURL;
        webPreferences.nodeIntegration = false;
        event.preventDefault();
    })

    contents.on("will-navigate", event => {
        event.preventDefault();
    });

    contents.on("new-window", (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});
// Security

app.on("ready", () => {
    mainWindow = createMainWindow(App.shutdown);
    mainWindow.webContents.on("did-finish-load", () => {
        if (mainWindow) {
            App.initialize(mainWindow);
        }
    });
});

app.on("window-all-closed", () => {
    log.info("Closing...");
    app.quit();
});

App.registerIpcHandlers();
