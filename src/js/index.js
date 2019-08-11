"use strict";
/*------------------------------------------------------------------------------
 *  Copyright (c) 2019 Sagar Gurtu
 *  Licensed under the MIT License.
 *  See License in the project root for license information.
 *----------------------------------------------------------------------------*/

(function () {

    const { ipcRenderer, remote } = require('electron');
    const customTitlebar = require('custom-electron-titlebar');

    /**
     * @desc Main view class containing all rendering and
     *       event listening operations
     */
    class Reader {

        constructor() {
            // Array of all path names
            this._paths = [];
            // Array of all tab elements
            this._tabs = [];
            // Total number of buckets
            this._buckets = 1;
            // Current tab element
            this._currentTab = null;
            // Current bucket index
            this._currentBucket = 0;
            // Number of tabs in one bucket
            this._computeStepTabs();

            // Title bar object
            this._titleBar = this._getTitleBar();

            this._tabContainer = document.getElementById('tabContainer');
            this._viewerElement = document.getElementById('viewer');
            this._leftSeekElement = document.getElementById('leftSeek');
            this._rightSeekElement =
                document.getElementById('rightSeek');
        }

        /**
         * @desc Computes stepTabs based on window size
         */
        _computeStepTabs() {
            this.stepTabs = Math.floor(window.innerWidth / 100);
        }

        /**
         * @returns custom title bar object
         */
        _getTitleBar() {
            return new customTitlebar.Titlebar({
                backgroundColor: customTitlebar.Color.fromHex('#333'),
                icon: 'assets/images/logo.png'
            });
        }

        /**
         * @desc Appends tabs at bucketPosition to tabContainer
         * @param {*} bucketPosition
         */
        _appendTabsToContainer(bucketPosition) {
            this._tabContainer.innerHTML = "";
            for (let i = bucketPosition * this.stepTabs;
                i < this._tabs.length &&
                i < (bucketPosition + 1) * this.stepTabs;
                i++) {
                this._tabContainer.append(this._tabs[i]);
            }
        }

        /**
         * @desc Toggles seek elements based on number of buckets
         *       and current bucket
         */
        _toggleSeek() {
            this._leftSeekElement.classList = [];
            this._rightSeekElement.classList = [];
            if (this._buckets > 1) {
                if (this._currentBucket === 0) {
                    this._leftSeekElement.classList.add('inactive-seek');
                    this._rightSeekElement.classList.add('active-seek');
                } else if (this._currentBucket === this._buckets - 1) {
                    this._leftSeekElement.classList.add('active-seek');
                    this._rightSeekElement.classList.add('inactive-seek');
                } else {
                    this._leftSeekElement.classList.add('active-seek');
                    this._rightSeekElement.classList.add('active-seek');
                }
            } else {
                this._leftSeekElement.classList.add('inactive-seek');
                this._rightSeekElement.classList.add('inactive-seek');
            }
        }

        /**
         * @desc Recalculates number of buckets
         */
        _updateBuckets() {
            this._buckets = Math.ceil(this._tabs.length / this.stepTabs);
        }

        /**
         * @desc Re-renders tabs in tabContainer
         */
        _adjustTabs() {
            this._updateBuckets();

            let currentPosition = this._tabs.indexOf(this._currentTab);
            let newBucketPosition =
                Math.floor(currentPosition / this.stepTabs);

            if (newBucketPosition !== this._currentBucket ||
                this._tabContainer.childElementCount !== this.stepTabs) {
                this._appendTabsToContainer(newBucketPosition);
                this._currentBucket = newBucketPosition;
            }

            this._toggleSeek();
        }

        /**
         * @desc Toggles background info visibility based on flag
         * @param {*} flag
         */
        _toggleBackgroundInfo(flag) {
            let visibility = flag ? 'visible' : 'hidden';
            document.getElementById('backgroundInfo').style.visibility =
                visibility;
        }

        /**
         * @desc Creates a new tab element
         * @param {*} pathName
         */
        _createTabElement(pathName) {
            const filename = pathName.substring(pathName.lastIndexOf('\\') + 1);
            const tabElement = document.createElement('div');
            const labelElement = document.createElement('div');
            const closeElement = document.createElement('div');
            let that = this;

            labelElement.innerHTML = filename;
            labelElement.setAttribute('class',
                'file-tab-label');

            closeElement.innerHTML = '&times;';
            closeElement.style.visibility = 'hidden';
            closeElement.setAttribute('class',
                'file-tab-close');

            tabElement.classList.add('file-tab');
            tabElement.classList.add('inactive');
            tabElement.setAttribute('data-path', pathName);

            tabElement.append(labelElement);
            tabElement.append(closeElement);

            closeElement.addEventListener('click', event => {
                let positionToRemove = that._tabs.indexOf(tabElement);
                if (that._tabs.length === 1) {
                    // If only one tab remaining, empty everything
                    that._currentTab = null;
                    that._tabContainer.innerHTML = "";
                    that._viewerElement.removeAttribute('src');
                    that._toggleMenuItems(false);
                    that._toggleBackgroundInfo(true);
                } else if (tabElement === that._currentTab) {
                    // If current tab is to be removed
                    let newCurrentPosition = positionToRemove;
                    // If tab to be removed is first in array,
                    // make next tab as current
                    if (positionToRemove === 0) {
                        newCurrentPosition = 1;
                    } else { // Else, make previous tab as current
                        newCurrentPosition -= 1;
                    }
                    // Switch to new current tab
                    that._switchTab(that._tabs[newCurrentPosition]);
                }
                // Remove tab from paths and tabs and update buckets
                that._paths.splice(positionToRemove, 1);
                that._tabs.splice(positionToRemove, 1);
                that._updateBuckets();

                // If atleast one tab remaining
                if (that._tabs.length > 0) {
                    // If this bucket has no tabs, render current bucket
                    if (that._tabContainer.childElementCount === 1) {
                        that._adjustTabs();
                    } else {
                        // Else, re-render this bucket without switching to
                        // current bucket
                        that._appendTabsToContainer(that._currentBucket);
                    }
                } else { // If no tabs remaining
                    that._toggleTabContainer(false);
                    that._updateTitle();
                }
                that._toggleSeek();
                event.stopPropagation();

            });

            tabElement.addEventListener('mouseover', event => {
                if (tabElement !== that._currentTab) {
                    closeElement.style.visibility = 'visible';
                }
            });

            tabElement.addEventListener('mouseleave', event => {
                if (tabElement !== that._currentTab) {
                    closeElement.style.visibility = 'hidden';
                }
            });

            tabElement.addEventListener('click', event => {
                if (tabElement !== that._currentTab) {
                    that._switchTab(tabElement);
                }
            });

            return tabElement;
        }

        /**
         * @desc Dispatches click event to window
         */
        _propagateClick() {
            window.dispatchEvent(new Event('mousedown'));
        }

        /**
         * @desc Propagates iframe events to window
         */
        _setViewerEvents() {
            this._viewerElement.contentDocument.addEventListener('click',
                this._propagateClick);
            this._viewerElement.contentDocument.addEventListener('mousedown',
                this._propagateClick);
        }

        /**
         * @desc Opens pathName in iframe
         * @param {*} pathName
         */
        _openInViewer(pathName) {
            this._viewerElement.src = 'lib/pdfjs/web/viewer.html?file=' +
                encodeURIComponent(pathName);
            this._viewerElement.onload = this._setViewerEvents.bind(this);
        }

        /**
         * @desc Focuses the current tab and opens current file in iframe
         */
        _focusCurrentTab() {
            this._tabs.forEach(tabElement => {
                tabElement.classList.remove('active');
                tabElement.classList.add('inactive');
                tabElement.getElementsByClassName('file-tab-close')[0]
                    .style.visibility = 'hidden';
            });
            this._currentTab.classList.remove('inactive');
            this._currentTab.classList.add('active');
            this._currentTab.getElementsByClassName('file-tab-close')[0]
                .style.visibility = 'visible';
            this._openInViewer(
                this._paths[this._tabs.indexOf(this._currentTab)]);
        }

        /**
         * @desc Switches to tabElement
         * @param {*} tabElement
         */
        _switchTab(tabElement) {
            if (this._currentTab !== tabElement) {
                this._currentTab = tabElement;
                this._updateTitle(this._paths[this._tabs.indexOf(tabElement)]);
                this._adjustTabs();
                this._focusCurrentTab();
            }
        }

        /**
         * @desc Toggles tab container visibililty
         * @param {*} visible
         */
        _toggleTabContainer(visible) {
            const visibility = visible ? 'visible' : 'hidden';
            this._tabContainer.style.visibility = visibility;
            this._leftSeekElement.style.visibility = visibility;
            this._rightSeekElement.style.visibility = visibility;
        }

        /**
         * @desc Sends enable/disable flag for toggle-menu-items
         * @param {*} flag
         */
        _toggleMenuItems(flag) {
            ipcRenderer.send('toggle-menu-items', flag);
        }

        /**
         * @desc Adds a new tab
         * @param {*} pathName
         */
        _addTab(pathName) {
            // Enable visibility of tabContainer, etc. when the
            // first tab is added
            if (this._tabs.length === 0) {
                this._toggleTabContainer(true);
                this._toggleMenuItems(true);
                this._toggleBackgroundInfo(false);
            }

            // Switch to tab if already open
            if (this._paths.indexOf(pathName) >= 0) {
                this._switchTab(this._tabs[this._paths.indexOf(pathName)]);
                return;
            }

            const tabElement = this._createTabElement(pathName);

            this._currentTab = tabElement;
            this._tabs.push(tabElement);
            this._paths.push(pathName);
            this._tabContainer.append(tabElement);
            this._adjustTabs();
            this._focusCurrentTab();
        }

        /**
         * @desc Updates title
         * @param {*} pathName
         */
        _updateTitle(pathName) {
            if (pathName) {
                this._titleBar.updateTitle(pathName.substring(
                    pathName.lastIndexOf('\\') + 1) + " - Lector");
            } else {
                this._titleBar.updateTitle("Lector");
            }
        }

        /**
         * @desc Opens a file
         * @param {*} pathName
         */
        _openFile(pathName) {
            this._updateTitle(pathName);
            this._addTab(pathName);
        }

        /**
         * @desc Sets menu item events
         *       'click' needs to be propagated (custom-electron-titlebar issue)
         */
        _setMenuItemEvents() {
            ipcRenderer.on('file-open', (event, args) => {
                this._propagateClick();
                this._openFile(args);
            });

            ipcRenderer.on('file-print', (event, args) => {
                this._propagateClick();
                if (this._viewerElement.src) {
                    this._viewerElement.contentDocument
                        .getElementById('print').dispatchEvent(
                            new Event('click'));
                }
            });

            ipcRenderer.on('file-properties', (event, args) => {
                this._propagateClick();
                if (this._viewerElement.src) {
                    this._viewerElement.contentDocument
                        .getElementById('documentProperties')
                        .dispatchEvent(new Event('click'));
                }
            });

            ipcRenderer.on('file-close', (event, args) => {
                this._propagateClick();
                if (this._currentTab) {
                    this._currentTab.getElementsByClassName('file-tab-close')[0]
                        .dispatchEvent(new Event('click'));
                }
            });

            ipcRenderer.on('view-fullscreen', (event, args) => {
                this._propagateClick();
                if (this._viewerElement.src) {
                    this._viewerElement.contentDocument
                        .getElementById('presentationMode')
                        .dispatchEvent(new Event('click'));
                }
            });
        }

        /**
         * @desc Sets seek element events
         */
        _setSeekEvents() {
            let that = this;
            this._leftSeekElement.addEventListener('click', event => {
                if (that._currentBucket > 0) {
                    that._currentBucket--;
                    that._appendTabsToContainer(that._currentBucket);
                    that._toggleSeek();
                }
            });

            this._rightSeekElement.addEventListener('click',
                event => {
                    if (that._currentBucket < that._buckets - 1) {
                        that._currentBucket++;
                        that._appendTabsToContainer(that._currentBucket);
                        that._toggleSeek();
                    }
                });

        }

        /**
         * @desc Sets window events
         */
        _setWindowEvents() {
            let that = this;
            // Adjust tabs on resize
            window.addEventListener('resize', event => {
                that._computeStepTabs();
                if (that._tabs.length > 0) {
                    that._adjustTabs();
                }
            });
        }

        /**
         * @desc Extracts path name from the arguments and opens the file.
         * @param {*} args 
         */
        _processArguments(args) {
            const argsLength = args.length;
            if (argsLength > 1 && args[argsLength - 1].endsWith(".pdf")) {
                this._openFile(args[argsLength - 1]);
            }
        }

        /**
         * @desc Sets external application events
         */
        _setExternalEvents() {
            let that = this;
            ipcRenderer.on('external-file-open', (event, args) => {
                that._processArguments(args);
            });
        }

        /**
         * @desc Process initial arguments to the application
         */
        _processRemoteArguments() {
            this._processArguments(remote.process.argv);
        }

        /**
         * @desc Runs the application
         */
        run() {
            this._setMenuItemEvents();
            this._setSeekEvents();
            this._setViewerEvents();
            this._setWindowEvents();
            this._setExternalEvents();
            this._processRemoteArguments();
        }

    }

    const application = new Reader();
    application.run();

})();
