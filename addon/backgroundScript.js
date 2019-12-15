'use strict';
/*******************************************************************************
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/

const HOST_APPLICATION_NAME = 'savetexttofile';
const TEST_CONNECTIVITY_ACTION = 'TEST_CONNECTIVITY';
const SAVE_TEXT_ACTION = 'SAVE';
const MENU_ITEM_ID = 'save-text-to-file-menu-item';
const NOTIFICATION_ID = 'save-text-to-file-notification';
const EXTENSION_TITLE = 'Save text to file';
const DEFAULT_FILE_NAME_PREFIX = 'save-text-to-file--';
const DDMMYYYY = '1';
const MMDDYYYY = '2';
const YYYYMMDD = '3';
const YYYYDDMM = '4';
const NONE = '5';
const DATE_CUSTOM_TITLE = '0';
const DATE_TITLE_CUSTOM = '1';
const CUSTOM_DATE_TITLE = '2';
const CUSTOM_TITLE_DATE = '3';
const TITLE_CUSTOM_DATE = '4';
const TITLE_DATE_CUSTOM = '5';
var saveFullTextOfPage;
var fileNamePrefix;
var dateFormat;
var fileNameComponentOrder;
var prefixPageTitleInFileName;
var fileNameComponentSeparator = '-';
var urlInFile;
var directory;
var directorySelectionDialog;
var notifications;
var conflictAction;
var testConnectivityPayload = {
  action: TEST_CONNECTIVITY_ACTION
};

function saveTextViaApp(directory, sanitizedFileName, fileContents) {
  var payload = {
    action: SAVE_TEXT_ACTION,
    filename: sanitizedFileName,
    directory: directory,
    fileContent: fileContents,
    conflictAction: conflictAction
  };

  browser.runtime.sendNativeMessage(
    HOST_APPLICATION_NAME,
    payload)
    .then(function onResponse(response) {
    var json = JSON.parse(response);
    if (json.status === 'Success') {
        notify('Text saved.');
    } else {
      notify('Error occurred saving text via host application. Check browser console.');
      console.log("SaveTextToFile: Native application response: " + response);
    }
  }, function onError(error) {
    notify('Error occurred communicating with host application. Check browser console.');
    console.log(error);
  });
}

function saveTextToFile(info, tab) {
  //var tabId = tab.id
  browser.tabs.executeScript(//tabID, 
  {
    code: '(' + getSelectionText.toString() + ')(' + saveFullTextOfPage + ')',
    allFrames: true,
    //matchAboutBlank: true
  }, function (results) {
    //debugger
    if (results[0]) {
      createFileContents(results[0].text, function(fileContents) {
        createFileName(function(fileName) {
          var sanitizedFileName = sanitizeFileName(fileName);
          browser.runtime.sendNativeMessage(HOST_APPLICATION_NAME, testConnectivityPayload)
          .then(function(response) {
            var responseObject = JSON.parse(response);
            if (responseObject.status === 'Success') {
              saveTextViaApp(directory, sanitizedFileName, fileContents);
            }
          }, function(error) {
            console.log('SaveTextToFile: Error communicating between the native application and web extension.');
            console.log(error);
            var blob = new Blob([fileContents], {
              type: 'text/plain'
            });
            var url = URL.createObjectURL(blob);
            startDownloadOfTextToFile(url, sanitizedFileName, results[0].fullPageText);
          });
        });
      });
    }
  });
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[\/\\|":*?<>]/g, '_');
}

function createFileContents(selectionText, callback) {
  if (urlInFile) {
    browser.tabs.query({
      active: true,
      lastFocusedWindow: true
    }, function(tabs) {
      var url = tabs[0].url;
      var text = url + '\n\n' + selectionText;
      callback(text);
    });
  } else {
    callback(selectionText);
  }
}

function createFileName(callback) {
  var fileName = '';
  var pageTitle = '';
  var date = _getDate();
  var extension = _getExtension();
  var customText = fileNamePrefix;
  _getPageTitleToFileName(function() {
    switch (fileNameComponentOrder) {
      case DATE_CUSTOM_TITLE:
        fileName = date + (date === '' ? '' : fileNameComponentSeparator) + customText + (pageTitle === '' ? '' : fileNameComponentSeparator) + pageTitle;
        break;
      case DATE_TITLE_CUSTOM:
        fileName = date + (date === '' ? '' : fileNameComponentSeparator) + pageTitle + (pageTitle === '' ? '' : fileNameComponentSeparator) + customText;
        break;
      case CUSTOM_DATE_TITLE:
        fileName = customText + (date === '' ? '' : fileNameComponentSeparator) + date + (pageTitle === '' ? '' : fileNameComponentSeparator) + pageTitle;
        break;
      case CUSTOM_TITLE_DATE:
        fileName = customText + (pageTitle === '' ? '' : fileNameComponentSeparator) + pageTitle + (date === '' ? '' : fileNameComponentSeparator) + date;
        break;
      case TITLE_CUSTOM_DATE:
        fileName = pageTitle + (pageTitle === '' ? '' : fileNameComponentSeparator) + customText + (date === '' ? '' : fileNameComponentSeparator) + date;
        break;
      case TITLE_DATE_CUSTOM:
        fileName = pageTitle + (pageTitle === '' ? '' : fileNameComponentSeparator) + date + (date === '' ? '' : fileNameComponentSeparator) + customText;
        break;
      default:
        notify('Error: Filename cannot be empty, please review preferences.');
        return;
    }
    fileName += extension;
    callback(fileName);
  });

  function _getPageTitleToFileName(callback) {
    if (prefixPageTitleInFileName) {
      browser.tabs.query({
        active: true,
        lastFocusedWindow: true
      }, function(tabs) {
        pageTitle = tabs[0].title;
        callback();
      });
    } else {
      callback();
    }
  }

  function _getDate() {
    var currentDate = new Date();
    var day = _determineDay();
    var month = _determineMonth();
    var year = currentDate.getFullYear();
    switch (dateFormat) {
      case DDMMYYYY:
        return `${day}-${month}-${year}`;
      case MMDDYYYY:
        return `${month}-${day}-${year}`
      case YYYYMMDD:
        return `${year}-${month}-${day}`
      case YYYYDDMM:
        return `${year}-${day}-${month}`
      case NONE:
        return '';
      default:
        return currentDate.getTime();
    }

    function _determineDay() {
      var dayPrefix = currentDate.getDate() < 10 ? '0' : '';
      return dayPrefix + currentDate.getDate();
    }

    function _determineMonth() {
      var monthPrefix = (currentDate.getMonth() + 1) < 10 ? '0' : '';
      return monthPrefix + (currentDate.getMonth() + 1);
    }
  }

  function _getExtension() {
    return '.txt';
  }
}

function startDownloadOfTextToFile(url, fileName, fullPageText) {
  var options = {
    filename: fileName,
    url: url,
    conflictAction: conflictAction
  };
  options.saveAs = !!directorySelectionDialog;
  browser.downloads.download(options, function(downloadId) {
    if (downloadId) {
      if (notifications) {
        //notify('Text saved.');
        setTimeout(() => {
          browser.downloads.search({ id: downloadId }).then(detail => {
            function readableSize(bytes) {
              var s = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
              var e = Math.floor(Math.log(bytes) / Math.log(1024));
              return (bytes / Math.pow(1024, Math.floor(e))).toFixed(2) + " " + s[e];
              // Bug 1190681 - Browser extension |notifications| API needs support for buttons in notifications in Firefox.
              // Seems no onButtonClicked support in Firefox.
            }
            let d = detail[0];
            notify(`Text saved.\n\nPath: ${d.filename}.\nSize: ${readableSize(d.fileSize)}.`, downloadId, fullPageText);
          });
        }, 150);
      }
    } else {
      var error = browser.runtime.lastError.toString();
      if (error.indexOf('Download canceled by the user') >= 0) {
        if (notifications) {
          notify('Save canceled.');
        }
      } else {
        notify('Error occurred.');
        console.log(error);
      }
    }
  });
}

browser.contextMenus.create({
  id: MENU_ITEM_ID,
  title: EXTENSION_TITLE,
  contexts: ['selection', 'page']
});

browser.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === MENU_ITEM_ID) {
    saveTextToFile(info, tab);
  }
});

browser.notifications.onClicked.addListener((notificationId) => {
  var downloadId = notificationId.match(/download-(\d+)/);
  //debugger;
  //if (typeof (downloadId) == "Array" && downloadId.length > 1) {
  if (downloadId.length > 1) { 
    downloadId = Number(downloadId[1]);
  }
  browser.downloads.show(downloadId);
});
function notify(message, id, fullPageText) {
  //browser.notifications.clear(NOTIFICATION_ID, function() {
  //debugger;
  id = !!id ? "download-" + id : "";
  var title = fullPageText ? EXTENSION_TITLE + ' (page)' : EXTENSION_TITLE + ' (selection)';
    browser.notifications.create(id, {
      title: title,
      type: 'basic',
      message: message,
      //button: button, // no support in Firefox
      iconUrl: browser.runtime.getURL('images/ico.png')
      // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions 支持按钮
    });
  //});
}

browser.storage.sync.get({
  saveFullTextOfPage: false,
  fileNamePrefix: DEFAULT_FILE_NAME_PREFIX,
  dateFormat: '0',
  fileNameComponentOrder: '0',
  prefixPageTitleInFileName: false,
  fileNameComponentSeparator: '-',
  urlInFile: false,
  directory: '',
  directorySelectionDialog: false,
  notifications: true,
  conflictAction: 'uniquify'
}, function(items) {
  saveFullTextOfPage = items.saveFullTextOfPage,
  fileNamePrefix = items.fileNamePrefix;
  dateFormat = items.dateFormat;
  fileNameComponentOrder = items.fileNameComponentOrder;
  prefixPageTitleInFileName = items.prefixPageTitleInFileName;
  fileNameComponentSeparator: items.fileNameComponentSeparator;
  urlInFile = items.urlInFile;
  directory = items.directory;
  directorySelectionDialog = items.directorySelectionDialog;
  notifications = items.notifications;
  conflictAction = items.conflictAction;
});

function getSelectionText(opt_getFullPageText) {
  function _getFullPageText() {
    var range, selection;
    selection = window.getSelection();
    range = document.createRange();
    range.selectNodeContents(document.body);
    selection.removeAllRanges();
    selection.addRange(range);
    var text = window.getSelection().toString();
    selection.removeAllRanges();
    return text;
  }

  var text = '';
  var fullPageText = false;
  if (window.getSelection) {
    text = window.getSelection().toString();
  }
  //debugger;
  if (!text && opt_getFullPageText) {
    text = _getFullPageText();
    fullPageText = true;
  }
  return { text, fullPageText};
}


browser.commands.onCommand.addListener(function(command) {
  if (command === 'save-text-to-file') {
    saveTextToFile();
  }
});

browser.storage.onChanged.addListener(function(changes) {
  function _setValues(target, change) {
    if (!(target && change)) return;
    // if (change.newValue === change.oldValue) return;
    target = change.newValue;
  }
  _setValues(saveFullTextOfPage, changes.saveFullTextOfPage);
  _setValues(fileNamePrefix, changes.fileNamePrefix);
  _setValues(dateFormat, changes.dateFormat);
  _setValues(fileNameComponentOrder, changes.fileNameComponentOrder);
  _setValues(prefixPageTitleInFileName, changes.prefixPageTitleInFileName);
  _setValues(fileNameComponentSeparator, changes.fileNameComponentSeparator);
  _setValues(urlInFile, changes.urlInFile);
  _setValues(directory, changes.directory);
  _setValues(directorySelectionDialog, changes.directorySelectionDialog);
  _setValues(notifications, changes.notifications);
  _setValues(conflictAction, changes.conflictAction);
  //
});

browser.runtime.sendNativeMessage(HOST_APPLICATION_NAME, testConnectivityPayload).then(function(response) {
  var responseObject = JSON.parse(response);
  if (responseObject.status === 'Success') {
    console.log('SaveTextToFile: Successfully tested communication between native application and webextension.');
  }
}, function(error) {
  console.log('SaveTextToFile: Error testing communication between native application and webextension.');
  console.log(error);
});
