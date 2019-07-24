"use strict";
/*-------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Sagar Gurtu
 *  Licensed under the MIT License. See License in the project root for license information.
 *------------------------------------------------------------------------------------------*/

(function () {

    const { ipcRenderer } = require('electron')
    const customTitlebar = require('custom-electron-titlebar')

    /**
     * @desc Main view class containing all rendering and event listening operations 
     */
    class Reader {

        constructor() {
            // Array of all path names
            this.files = []
            // Array of all tab elements
            this.tabs = []
            // Total number of buckets
            this.buckets = 1
            // Current tab element
            this.currentTab = null
            // Current bucket index
            this.currentBucket = 0
            // Number of tabs in one bucket
            this._computeStepTabs()

            // Title bar object
            this.titleBar = this._getTitleBar()

            this.tabContainer = document.getElementById('tabContainer')
            this.viewerElement = document.getElementById('viewer')
            this.leftSeekElement = document.getElementById('leftSeek')
            this.rightSeekElement = document.getElementById('rightSeek')
        }

        /**
         * @desc Computes stepTabs based on window size
         */
        _computeStepTabs() {
            this.stepTabs = Math.floor(window.innerWidth / 100)
        }

        /**
         * @returns custom title bar object
         */
        _getTitleBar() {
            return new customTitlebar.Titlebar({
                backgroundColor: customTitlebar.Color.fromHex('#333'),
                icon: 'assets/images/logo.png'
            })
        }

        /**
         * @desc Appends tabs at bucketPosition to tabContainer
         * @param {*} bucketPosition 
         */
        _appendTabsToContainer(bucketPosition) {
            this.tabContainer.innerHTML = ""
            for (let i = bucketPosition * this.stepTabs;
                i < this.tabs.length && i < (bucketPosition + 1) * this.stepTabs;
                i++) {
                this.tabContainer.append(this.tabs[i])
            }
        }

        /**
         * @desc Toggles seek elements based on number of buckets and current bucket
         */
        _toggleSeek() {
            this.leftSeekElement.classList = []
            this.rightSeekElement.classList = []
            if (this.buckets > 1) {
                if (this.currentBucket === 0) {
                    this.leftSeekElement.classList.add('inactive-seek')
                    this.rightSeekElement.classList.add('active-seek')
                } else if (this.currentBucket === this.buckets - 1) {
                    this.leftSeekElement.classList.add('active-seek')
                    this.rightSeekElement.classList.add('inactive-seek')
                } else {
                    this.leftSeekElement.classList.add('active-seek')
                    this.rightSeekElement.classList.add('active-seek')
                }
            }
            else {
                this.leftSeekElement.classList.add('inactive-seek')
                this.rightSeekElement.classList.add('inactive-seek')
            }
        }

        /**
         * @desc Recalculates number of buckets
         */
        _updateBuckets() {
            this.buckets = Math.ceil(this.tabs.length / this.stepTabs)
        }

        /**
         * @desc Re-renders tabs in tabContainer
         */
        _adjustTabs() {
            this._updateBuckets()

            let currentPosition = this.tabs.indexOf(this.currentTab)
            let newBucketPosition = Math.floor(currentPosition / this.stepTabs)

            if (newBucketPosition !== this.currentBucket || 
                this.tabContainer.childElementCount !== this.stepTabs) {
                this._appendTabsToContainer(newBucketPosition)
                this.currentBucket = newBucketPosition
            }

            this._toggleSeek()
        }

        /**
         * @desc Toggles background info visibility based on flag
         * @param {*} flag 
         */
        _toggleBackgroundInfo(flag) {
            let visibility = flag ? 'visible' : 'hidden'
            document.getElementById('backgroundInfo').style.visibility = visibility
        }

        /**
         * @desc Creates a new tab element
         * @param {*} pathname 
         */
        _createTabElement(pathname) {
            const filename = pathname.substring(pathname.lastIndexOf('\\') + 1)
            const tabElement = document.createElement('div')
            const labelElement = document.createElement('div')
            const closeElement = document.createElement('div')
            let that = this

            labelElement.innerHTML = filename
            labelElement.setAttribute('class', 'file-tab-label')

            closeElement.innerHTML = '&times;'
            closeElement.style.visibility = 'hidden'
            closeElement.setAttribute('class', 'file-tab-close')

            tabElement.classList.add('file-tab')
            tabElement.classList.add('inactive')
            tabElement.setAttribute('data-path', pathname)

            tabElement.append(labelElement)
            tabElement.append(closeElement)

            closeElement.addEventListener('click', event => {
                let positionToRemove = that.tabs.indexOf(tabElement)
                if (that.tabs.length === 1) {
                    // If only one tab remaining, empty everything
                    that.currentTab = null
                    that.tabContainer.innerHTML = ""
                    that.viewerElement.removeAttribute('src')
                    that._toggleMenuItems(false)
                    that._toggleBackgroundInfo(true)
                } else if (tabElement === that.currentTab) {
                    // If current tab is to be removed
                    let newCurrentPosition = positionToRemove
                    // If tab to be removed is first in array, make next tab as current
                    if (positionToRemove === 0) {
                        newCurrentPosition = 1
                    } else { // Else, make previous tab as current
                        newCurrentPosition -= 1
                    }
                    // Switch to new current tab
                    that._switchTab(that.tabs[newCurrentPosition])
                }
                // Remove tab from files and tabs and update buckets
                that.files.splice(positionToRemove, 1)
                that.tabs.splice(positionToRemove, 1)
                that._updateBuckets()

                // If atleast one tab remaining
                if (that.tabs.length > 0) {
                    // If this bucket has no tabs, render current bucket
                    if (that.tabContainer.childElementCount === 1) {
                        that._adjustTabs()
                    } else { // Else, re-render this bucket without switching to current bucket
                        that._appendTabsToContainer(that.currentBucket)
                    }
                } else { // If no tabs remaining
                    that._toggleTabContainer(false)
                    that._updateTitle()
                }
                that._toggleSeek()
                event.stopPropagation()

            })

            tabElement.addEventListener('mouseover', event => {
                if (tabElement !== that.currentTab)
                    closeElement.style.visibility = 'visible'
            })

            tabElement.addEventListener('mouseleave', event => {
                if (tabElement !== that.currentTab)
                    closeElement.style.visibility = 'hidden'
            })

            tabElement.addEventListener('click', event => {
                if (tabElement !== that.currentTab)
                    that._switchTab(tabElement)
            })

            return tabElement
        }

        /**
         * @desc Dispatches click event to window
         */
        _propagateClick() {
            window.dispatchEvent(new Event('mousedown'))
        }

        /**
         * @desc Propagates iframe events to window
         */
        _setViewerEvents() {
            this.viewerElement.contentDocument.addEventListener('click', this._propagateClick)
            this.viewerElement.contentDocument.addEventListener('mousedown', this._propagateClick)
        }

        /**
         * @desc Opens pathname in iframe
         * @param {*} pathname 
         */
        _openInViewer(pathname) {
            this.viewerElement.src = 'lib/pdfjs/web/viewer.html?file=' + encodeURIComponent(pathname)
            this.viewerElement.onload = this._setViewerEvents.bind(this)
        }

        /**
         * @desc Focuses the current tab and opens current file in iframe
         */
        _focusCurrentTab() {
            this.tabs.forEach(tabElement => {
                tabElement.classList.remove('active')
                tabElement.classList.add('inactive')
                tabElement.getElementsByClassName('file-tab-close')[0].style.visibility = 'hidden'
            })
            this.currentTab.classList.remove('inactive')
            this.currentTab.classList.add('active')
            this.currentTab.getElementsByClassName('file-tab-close')[0].style.visibility = 'visible'
            this._openInViewer(this.files[this.tabs.indexOf(this.currentTab)])
        }

        /**
         * @desc Switches to tabElement
         * @param {*} tabElement 
         */
        _switchTab(tabElement) {
            if (this.currentTab !== tabElement) {
                this.currentTab = tabElement
                this._updateTitle(this.files[this.tabs.indexOf(tabElement)])
                this._adjustTabs()
                this._focusCurrentTab()
            }
        }

        /**
         * @desc Toggles tab container visibililty
         * @param {*} visible 
         */
        _toggleTabContainer(visible) {
            const visibility = visible ? 'visible' : 'hidden'
            this.tabContainer.style.visibility = visibility
            this.leftSeekElement.style.visibility = visibility
            this.rightSeekElement.style.visibility = visibility
        }

        /**
         * @desc Sends enable/disable flag for toggle-menu-items
         * @param {*} flag 
         */
        _toggleMenuItems(flag) {
            ipcRenderer.send('toggle-menu-items', flag)
        }

        /**
         * @desc Adds a new tab
         * @param {*} pathname 
         */
        _addTab(pathname) {
            // Enable visibility of tabContainer, etc. when the first tab is added
            if (this.tabs.length === 0) {
                this._toggleTabContainer(true)
                this._toggleMenuItems(true)
                this._toggleBackgroundInfo(false)
            }

            // Switch to tab if already open
            if (this.files.indexOf(pathname) >= 0) {
                this._switchTab(this.tabs[this.files.indexOf(pathname)])
                return
            }

            const tabElement = this._createTabElement(pathname)

            this.currentTab = tabElement
            this.tabs.push(tabElement)
            this.files.push(pathname)
            this.tabContainer.append(tabElement)
            this._adjustTabs()
            this._focusCurrentTab()
        }

        /**
         * @desc Updates title
         * @param {*} pathname 
         */
        _updateTitle(pathname) {
            if (pathname)
                this.titleBar.updateTitle(pathname.substring(pathname.lastIndexOf('\\') + 1) + " - Lector")
            else
                this.titleBar.updateTitle("Lector")
        }

        /**
         * @desc Opens a file
         * @param {*} pathname 
         */
        _openFile(pathname) {
            this._updateTitle(pathname)
            this._addTab(pathname)
        }

        /**
         * @desc Sets menu item events
         *       'click' needs to be propagated (custom-electron-titlebar issue)
         */
        _setMenuItemEvents() {
            ipcRenderer.on('file-open', (event, args) => {
                this._propagateClick()
                this._openFile(args)
            })

            ipcRenderer.on('file-print', (event, args) => {
                this._propagateClick()
                if (this.viewerElement.src)
                    this.viewerElement.contentDocument.getElementById('print').dispatchEvent(new Event('click'))
            })

            ipcRenderer.on('file-properties', (event, args) => {
                this._propagateClick()
                if (this.viewerElement.src)
                    this.viewerElement.contentDocument.getElementById('documentProperties').dispatchEvent(new Event('click'))
            })

            ipcRenderer.on('file-close', (event, args) => {
                this._propagateClick()
                if (this.currentTab)
                    this.currentTab.getElementsByClassName('file-tab-close')[0].dispatchEvent(new Event('click'))
            })

            ipcRenderer.on('view-fullscreen', (event, args) => {
                this._propagateClick()
                if (this.viewerElement.src)
                    this.viewerElement.contentDocument.getElementById('presentationMode').dispatchEvent(new Event('click'))
            })
        }

        /**
         * @desc Sets seek element events
         */
        _setSeekEvents() {
            let that = this
            this.leftSeekElement.addEventListener('click', event => {
                if (that.currentBucket > 0) {
                    that.currentBucket--
                    that._appendTabsToContainer(that.currentBucket)
                    that._toggleSeek()
                }
            })

            this.rightSeekElement.addEventListener('click', event => {
                if (that.currentBucket < that.buckets - 1) {
                    that.currentBucket++
                    that._appendTabsToContainer(that.currentBucket)
                    that._toggleSeek()
                }
            })

        }

        /**
         * @desc Sets window events
         */
        _setWindowEvents() {
            let that = this
            // Adjust tabs on resize
            window.addEventListener('resize', event => {
                that._computeStepTabs()
                if (that.tabs.length > 0)
                    that._adjustTabs()
            })
        }

        /**
         * @desc Runs the application
         */
        run() {
            this._setMenuItemEvents()
            this._setSeekEvents()
            this._setViewerEvents()
            this._setWindowEvents()
        }

    }

    const application = new Reader()
    application.run()

})()
