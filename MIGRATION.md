# Migration from Earlier Versions

Increasing the major version means a breaking change in existing functionality, or at least deprecation of a feature, which has been replaced by an alternative. When you upgrade `grunt-html-dom-snapshot` to a higher major version, you might ned to update your configuration or even the task commands.

I recommend you upgrading `grunt-html-dom-snapshot` regularly. Functionality and security bugs are looked for and fixed in latest versions, not in old and thus little used ones.

# Upgrade Instructions

- [5 to 6](#5-to-6)
- [4 to 5](#4-to-5)
- [3 to 4](#3-to-4)
- [2 to 3](#2-to-3)
- [1 to 2](#1-to-2)
- [0 to 1](#0-to-1)

## 5 to 6

[WebdriverIO] limited the [elementSendKeys] method to behave just like the [WebDriver protocol requires](https://w3c.github.io/webdriver/#dfn-element-send-keys), which affects [`elementSendKeys`](INSTRUCTIONS.md#elementSendKeys) instruction. **An array of keys to press cannot be sent any more. Only a string with letters to type.** If you need to send special keys like "Delete", for example focus the element by [`focus`](INSTRUCTIONS.md#focus) and then use [`keys`](INSTRUCTIONS.md#keys).

The automated build on Travis started to fail with the Node.js 8, although the dependent modules should still work with it. **You should upgrade Node.js in your environment to the version 10 or newer**, to be on the safe side, and check, that everything still works.

See the [release notes for v6] for more information.

## 4 to 5

THe evaluation order of the "is" instructions has changed. **If you used more than one "is" instructions in a single command block**, check if the scenario still works, when the instructions follow this order:

* isExisting
* isVisible
* isVisibleWithinViewport
* isEnabled
* isSelected
* isFocused
* isNotExisting
* isNotVisible
* isNotVisibleWithinViewport
* isNotEnabled
* isNotFocused

See the [release notes for v5] for more information.

## 3 to 4

Although you may not notice any breaking changes, **v4 upgraded to [WebdriverIO] 5 and dropped support of [Node.js] older than 8**. You should upgrade Node.js in your environment and check, that everything still works.

[WebdriverIO] overhauled its API, which meant adapting each instruction available in `grunt-html-dom-snapshot`. They all remained compatible, except for:

* [scroll](INSTRUCTIONS.md#scroll) does not support the `offset` parameter any more. Remove it. Scrolling will be performed to the center of the element.
* [isVisible](INSTRUCTIONS.md#isvisible), [isNotVisible](INSTRUCTIONS.md#isnotvisible) and [clickIfVisible](INSTRUCTIONS.md#clickIfVisible) use the function [isElementDisplayed] which should work in the same way like the removed [isVisible], but you should still check if your visibility checks still work.

See the [release notes for v4] for more information.

## 2 to 3

You will probably not notice any breaking changes in your scripts during this upgrade.

**Unrecognised instructions are forbidden in v3.** They hid typos in instruction that you wanted to execute. If you put foreign keys to the task commands, you will have to remove them and use comments instead, for example.

Old code:

```js
{
  "doNotForget": "focus the other elements later",
  "click": "input",
  "file": "focused-input"
}
```

New code:

```js
{
  // TODO: Focus the other elements later.
  "click": "input",
  "file": "focused-input"
}
```

See the [release notes for v3] for more information.

## 1 to 2

**v2 does not use PhantomJS by default any more.** The development has been stopped in favour of the headless mode introduced by Chrome and Firefox. You can still enable the webdriver for PhantomJS explicitly. However, it will be used less and less in the world and the quality of its support will deteriorate. Plan switching to the headless mode of Chrome and check, that your tests still work. If you did not use PhantomJS-specific API, you would only adapt the task configuration and should not notice any breaking changes in your scripts.

Old configuration:

```js
'selenium_standalone': {
  serverConfig: {
    seleniumVersion: '3.7.1',
    seleniumDownloadURL: 'http://selenium-release.storage.googleapis.com',
    drivers: {
      phantomjs: {
        version: '2.1.1'
      }
    }
  }
},
'html-dom-snapshot': {
  options: {
    webdriver: {
      capabilities: {
        browserName: 'phantomjs'
      }
    }
  }
}
```

New configuration:

```js
'selenium_standalone': {
  serverConfig: {
    seleniumVersion: '3.141.5',
    seleniumDownloadURL: 'http://selenium-release.storage.googleapis.com',
    drivers: {
      chrome: {
        version: '77.0.3865.40',
        arch: process.arch,
        baseURL: 'https://chromedriver.storage.googleapis.com'
      }
    }
  }
},
'html-dom-snapshot': {
  options: {
    webdriver: {
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless']
        }
      }
    }
  }
}
```

See the [release notes for v2] for more information.

## 0 to 1

**v1 runs only in Node.js 6 or newer.** Node.js 4 reeached its end-of-life and does not use PhantomJS by default any more. The development has been stopped in favour of the headless mode introduced by Chrome and Firefox. You can still enable the webdriver for PhantomJS explicitly. However, it will be used less and less in the world and the quality of its support will deteriorate. Plan switching to the headless mode of Chrome and check, that your tests still work. If you did not use PhantomJS-specific API, you would only adapt the task configuration and should not notice any breaking changes in your scripts.

See the [release notes for v1] for more information.

[WebdriverIO]: http://webdriver.io/
[Node.js]: https://nodejs.org
[isElementDisplayed]: https://webdriver.io/docs/api/webdriver.html#iselementdisplayed
[isVisible]: http://v4.webdriver.io/api/state/isVisible.html
[elementSendKeys]: https://webdriver.io/docs/api/webdriver.html#elementsendkeys
[release notes for v6]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v6.0.0
[release notes for v5]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v5.0.0
[release notes for v4]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v4.0.0
[release notes for v3]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v3.0.0
[release notes for v2]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v2.0.0
[release notes for v1]: https://github.com/prantlf/grunt-html-dom-snapshot/releases/tag/v1.0.0
