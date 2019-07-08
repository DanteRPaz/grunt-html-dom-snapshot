// grunt-html-dom-snapshot
// https://github.com/prantlf/grunt-html-dom-snapshot
//
// Copyright (c) 2017-2018 Ferdinand Prantl
// Licensed under the MIT license.
//
// Takes snapshots of the HTML markup on web pages - their immediate DOM
// content - and screenshots of their viewport - how they look like.

'use strict'

const {writeFile} = require('fs')
const pad = require('pad-left')
const {basename, dirname, isAbsolute, join} = require('path')
const mkdirp = require('mkdirp')
const instructions = [
  'setViewport', 'url', 'go', 'scroll', 'clearValue', 'setValue', 'addValue',
  'selectOptionByIndex', 'selectOptionByValue', 'moveCursor',
  'click', 'clickIfVisible', 'keys', 'wait', 'hasAttribute', 'hasClass', 'hasValue',
  'hasText', 'hasInnerHtml', 'hasOuterHtml',
  'isEnabled', 'isExisting', 'isFocused', 'isSelected', 'isVisible',
  'isVisibleWithinViewport', 'isNotEnabled', 'isNotExisting',
  'isNotFocused', 'isNotSelected', 'isNotVisible',
  'isNotVisibleWithinViewport', 'abort'
].map(instruction => require('./instructions/' + instruction))
const directoryCounts = {}
let fileCount = 0

module.exports = grunt => {
  grunt.registerMultiTask('html-dom-snapshot',
    'Takes snapshots of the HTML markup on web pages - their immediate DOM content - and screenshots of their viewport - how they look like.',
    function () {
      const webdriverio = require('webdriverio')
      const done = this.async()
      const data = this.data
      const options = this.options({
        webdriver: {
          desiredCapabilities: {
            browserName: 'chrome',
            chromeOptions: {
              args: ['--headless']
            }
          }
        },
        viewport: {
          width: 1024,
          height: 768
        },
        selectorTimeout: 10000,
        instructionDelay: 0,
        doctype: '<!DOCTYPE html>',
        snapshots: 'snapshots',
        fileNumbering: false,
        fileNumberDigits: 3,
        fileNumberSeparator: '.',
        hangOnError: false,
        force: false
      })
      const target = this.target
      const pages = data.pages
      const snapshots = options.dest
      const viewport = options.viewport
      const webdriver = options.webdriver
      const browserCapabilities = options.browserCapabilities
      const lastViewport = {
        width: viewport.width,
        height: viewport.height
      }
      let urlCount = 0
      let snapshotCount = 0
      let screenshotCount = 0
      let failed
      let commands
      if (browserCapabilities) {
        grunt.log.warn('The property "browserCapabilities" is deprecated. ' +
                      'Use "webdriver.desiredCapabilities" with the same content.')
        webdriver.desiredCapabilities = browserCapabilities
        delete options.browserCapabilities
      }
      if (pages) {
        grunt.log.warn('The property "pages" is deprecated. ' +
                      'Use "commands" with the same content.')
      }
      if (snapshots) {
        grunt.log.warn('The property "dest" is deprecated. ' +
                      'Use "snapshots" with the same content.')
        options.snapshots = snapshots
        delete options.dest
      }
      // TODO: Remove this, as soon as the moveTo command is re-implemented.
      webdriver.deprecationWarnings = false

      grunt.verbose.writeln('Open web browser window for the target "' +
                            target + '".')
      let client = webdriverio.remote(webdriver)
      client.init()
            .then(setViewportSize)
            .then(gatherCommands)
            .then(performConditionalCommands)
            .then(() => {
              grunt.log.ok(commands.length + ' ' +
                  grunt.util.pluralize(commands.length, 'command/commands') +
                  ' performed, ' + urlCount + ' ' +
                  grunt.util.pluralize(urlCount, 'page/pages') +
                  ' visited, ' + snapshotCount + ' ' +
                  grunt.util.pluralize(snapshotCount, 'snapshot/snapshots') +
                  ' and ' + screenshotCount + ' ' +
                  grunt.util.pluralize(screenshotCount, 'screenshot/screenshots') +
                  ' written.')
              return stop(false)
            })
            .catch(error => {
              failed = true
              grunt.verbose.error(error.stack)
              grunt.log.error(error)
              if (!options.hangOnError) {
                return stop(false)
              }
            })
            .then(() => {
              if (failed) {
                const warn = options.force || options.hangOnError ? grunt.log.warn : grunt.fail.warn
                warn('Taking snapshots failed.')
                if (options.hangOnError) {
                  warn('Letting the browser run for your investigation.\nTerminate this process or interrupt it by Ctrl+C, once you are finished.')
                }
              }
            })
            .then(() => {
              if (!(failed && options.hangOnError)) {
                done()
              }
            })

      process
        .on('SIGINT', stop.bind(null, true))
        .on('SIGTERM', stop.bind(null, true))

      function stop (exit) {
        function exitProcess () {
          if (exit) {
            grunt.log.writeln('Stopping the process...')
            process.exit(1)
          }
        }
        if (client) {
          const oldClient = client
          client = null
          grunt.log.writeln('Closing the browser in one second...')
          const result = oldClient
            .end()
            // Workaround for hanging chromedriver; for more information
            // see https://github.com/vvo/selenium-standalone/issues/351
            .pause(1000)
          // The promise returned from pause() appears to never resolve.
          setTimeout(exitProcess, 1500)
          return result
        } else {
          exitProcess()
        }
      }

      function gatherCommands () {
        let scenarios = ensureArray(data.scenarios)
        commands = data.commands || pages
        if (scenarios) {
          const currentDirectory = process.cwd()
          commands = scenarios
            .reduce((scenarios, scenario) =>
              scenarios.concat(grunt.file.expand(scenario)), [])
            .reduce((scenarios, scenario) => {
              grunt.verbose.writeln('Load scenario  "' + scenario + '".')
              if (!isAbsolute(scenario)) {
                scenario = join(currentDirectory, scenario)
              }
              return scenarios.concat(require(scenario))
            }, commands || [])
        }
        if (!commands) {
          commands = [
            Object.assign({
              file: target
            }, data)
          ]
        }
      }

      function setViewportSize () {
        grunt.verbose.writeln('Resize viewport to ' + lastViewport.width +
                              'x' + lastViewport.height + '.')
        return client.setViewportSize(lastViewport)
      }

      function ensureDirectory (name) {
        return new Promise((resolve, reject) =>
          mkdirp(name, error => {
            if (error) {
              reject(error)
            } else {
              resolve()
            }
          }))
      }

      function performConditionalCommands (subCommands) {
        return (subCommands || commands).reduce((promise, command) =>
          promise.then(() => performConditionalCommand(command)), Promise.resolve())
      }

      function performConditionalCommand (command) {
        const ifCommands = ensureArray(command.if)
        if (!ifCommands) {
          return performCommand(command)
        }
        grunt.verbose.writeln('Testing a condition.')
        const promise = performCommands(ifCommands)
          .then(() => performConditionalBranch(command.then, true))
          .catch(() => performConditionalBranch(command.else, false))
        promise.then(logEnd, logEnd)
        return promise

        function logEnd () {
          grunt.verbose.writeln('The conditional command ended.')
        }
      }

      function performConditionalBranch (branch, result) {
        const commands = ensureArray(branch)
        grunt.verbose.writeln('The condition evaluated to ' + result + '.')
        if (commands) {
          grunt.verbose.writeln('Continuing with the conditional branch.')
          return performConditionalCommands(commands)
        }
        return Promise.resolve()
      }

      function performCommands (subCommands) {
        return (subCommands || commands).reduce((promise, command) =>
          promise.then(() => performCommand(command)), Promise.resolve())
      }

      function performCommand (command) {
        const commandOptions = Object.assign({
          lastViewport: lastViewport
        }, options, command.options || {})
        const file = command.file
        const fileNumbering = commandOptions.fileNumbering
        const fileNumberDigits = commandOptions.fileNumberDigits
        const fileNumberSeparator = commandOptions.fileNumberSeparator
        const viewport = commandOptions.viewport
        const screenshots = commandOptions.screenshots
        const commandInstructions = instructions.map(instruction => {
          return {
            perform: instruction.perform,
            detected: instruction.detect(command)
          }
        })
        const instructionDelay = commandOptions.instructionDelay
        let snapshots = commandOptions.dest
        let viewportSet
        if (snapshots) {
          grunt.log.warn('The property "dest" is deprecated. ' +
                        'Use "snapshots" with the same content.')
        } else {
          snapshots = commandOptions.snapshots
        }
        if (!(commandInstructions.some(instruction => instruction.detected) || file)) {
          throw new Error('Missing instruction in the command ' +
                          'in the target "' + target + '".\n' +
                          JSON.stringify(command))
        }
        if ((viewport.width !== lastViewport.width ||
            viewport.height !== lastViewport.height) && !lastViewport.explicit) {
          lastViewport.width = viewport.width
          lastViewport.height = viewport.height
          viewportSet = performInstruction(setViewportSize())
        } else {
          viewportSet = Promise.resolve()
        }
        if (command.url) {
          ++urlCount
        }
        return commandInstructions.reduce((previous, instruction) =>
          previous.then(() => {
            const detected = instruction.detected
            if (detected) {
              return performInstruction(instruction.perform(grunt, target,
                 client, command, commandOptions, detected))
            }
          }), viewportSet)
        .then(() => {
          if (file) {
            if (snapshots && screenshots) {
              increaseFileCount(file)
              return performInstruction(
                Promise.all([makeSnapshot(), makeScreenshot()]))
            }
            if (snapshots) {
              increaseFileCount(file)
              return performInstruction(makeSnapshot())
            }
            if (screenshots) {
              increaseFileCount(file)
              return performInstruction(makeScreenshot())
            }
          }
        })

        function performInstruction (promise) {
          if (instructionDelay) {
            return promise.then(() => new Promise(
              resolve => setTimeout(resolve, instructionDelay)))
          }
          return promise
        }

        function makeSnapshot () {
          return client.getHTML('html')
                      .then(saveContent)
        }

        function makeScreenshot () {
          return client.screenshot()
                      .then(saveImage)
        }

        function saveContent (html) {
          let fileName = file.toLowerCase()
          fileName = fileName.endsWith('.html') ||
                     fileName.endsWith('.htm') ? file : file + '.html'
          if (fileNumbering) {
            fileName = numberFileName(fileName, fileNumbering)
          }
          fileName = join(snapshots, fileName)
          grunt.log.ok('Write snapshot to "' + fileName + '".')
          const directory = dirname(fileName)
          return ensureDirectory(directory)
            .then(() => new Promise((resolve, reject) =>
              writeFile(fileName, commandOptions.doctype + html,
                error => {
                  if (error) {
                    reject(error)
                  } else {
                    ++snapshotCount
                    resolve()
                  }
                })
            ))
        }

        function saveImage (png) {
          let fileName = file.toLowerCase()
          fileName = fileName.endsWith('.html')
                     ? file.substr(0, file.length - 5)
                     : fileName.endsWith('.htm')
                     ? file.substr(0, file.length - 4) : file
          if (fileNumbering) {
            fileName = numberFileName(fileName, fileNumbering)
          }
          fileName = join(screenshots, fileName + '.png')
          grunt.log.ok('Write screenshot to "' + fileName + '".')
          const directory = dirname(fileName)
          return ensureDirectory(directory)
            .then(() => new Promise((resolve, reject) =>
              writeFile(fileName, Buffer.from(png.value, 'base64'),
                error => {
                  if (error) {
                    reject(error)
                  } else {
                    ++screenshotCount
                    resolve()
                  }
                })
            ))
        }

        function increaseFileCount (file) {
          ++fileCount
          if (file.indexOf('/') > 0) {
            const directory = dirname(file)
            let directoryCount = directoryCounts[directory]
            if (directoryCount) {
              directoryCounts[directory] = directoryCount + 1
            } else {
              directoryCounts[directory] = 1
            }
          }
        }

        function numberFileName (fileName, fileNumbering) {
          let directory, number
          if (fileName.indexOf('/') > 0) {
            directory = dirname(fileName)
            if (fileNumbering === true) {
              number = fileCount
            } else {
              number = directoryCounts[directory]
            }
          } else {
            number = fileCount
          }
          if (directory) {
            fileName = basename(fileName)
          }
          fileName = pad(number.toString(), fileNumberDigits, '0') +
                     fileNumberSeparator + fileName
          if (directory) {
            fileName = join(directory, fileName)
          }
          return fileName
        }
      }

      function ensureArray (item) {
        if (item && !Array.isArray(item)) {
          item = [item]
        }
        return item
      }
    })
}
