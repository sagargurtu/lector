"use strict";
/*------------------------------------------------------------------------------
 *  Copyright (c) 2019 Sagar Gurtu
 *  Licensed under the MIT License.
 *  See License in the project root for license information.
 *----------------------------------------------------------------------------*/

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { buildMenuTemplate } = require('./menutemplate');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, aboutWin;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 300,
        minHeight: 300,
        icon: './src/assets/images/logo.png',
        webPreferences: {
            plugins: true,
            nodeIntegration: true
        },
        frame: false
    });

    // and load the index.html of the app.
    win.loadFile('./src/index.html');

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null;
        aboutWin = null;
    });

    // Create a menu using template
    const menu = Menu.buildFromTemplate(buildMenuTemplate(win));
    // Create about window
    menu.getMenuItemById('about').click = () => {

        if (!aboutWin) {
            aboutWin = new BrowserWindow({
                width: 300,
                height: 150,
                resizable: false,
                frame: false,
                parent: win,
                modal: true,
                webPreferences: {
                    nodeIntegration: true
                },
            });

            aboutWin.loadFile('./src/about.html');

            aboutWin.on('closed', () => {
                aboutWin = null;
            })

        }
    };

    // Set application menu
    Menu.setApplicationMenu(menu);

    // Add event listener for enabling/disabling menu items
    ipcMain.on('toggle-menu-items', (event, flag) => {
        menu.getMenuItemById('file-print').enabled = flag;
        menu.getMenuItemById('file-properties').enabled = flag;
        menu.getMenuItemById('file-close').enabled = flag;
        menu.getMenuItemById('view-fullscreen').enabled = flag;
    });

}

// Allow only a single instance of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) {
                win.restore();
            }
            win.focus();
            win.webContents.send('external-file-open', commandLine);
        }
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        // On macOS it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });
}


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.